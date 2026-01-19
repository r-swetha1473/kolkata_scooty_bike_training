const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const config = require('../app.config');
const router = express.Router();

// POST /recognition - User submits phone + invoice
router.post('/', authenticate, async (req, res, next) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { phone_number, invoice_reference, invoice_file_url } = req.body;

    // Validate required fields
    if (!phone_number) {
      throw new Error('Phone number is required');
    }

    if (!invoice_file_url) {
      throw new Error('Invoice file URL is required');
    }

    // Validate phone number format (10 digits)
    if (!config.booking.phoneNumberPattern.test(phone_number)) {
      throw new Error(config.booking.phoneNumberErrorMessage);
    }

    // Check if user already has a pending or approved recognition
    const existingRecognition = await client.query(
      `SELECT id, status FROM student_recognition 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.user.id]
    );

    // If user has an approved recognition, they can't submit again
    if (existingRecognition.rows.length > 0 && existingRecognition.rows[0].status === 'approved') {
      throw new Error('You already have an approved student recognition. Contact support if you need to update your information.');
    }

    // Insert new recognition record (or update if pending/rejected)
    let result;
    if (existingRecognition.rows.length > 0 && 
        (existingRecognition.rows[0].status === 'pending' || existingRecognition.rows[0].status === 'rejected')) {
      // Update existing record
      result = await client.query(
        `UPDATE student_recognition 
         SET phone_number = $1,
             invoice_reference = $2,
             invoice_file_url = $3,
             status = 'pending',
             created_at = NOW(),
             approved_at = NULL
         WHERE id = $4
         RETURNING *`,
        [phone_number, invoice_reference || null, invoice_file_url, existingRecognition.rows[0].id]
      );
    } else {
      // Insert new record
      result = await client.query(
        `INSERT INTO student_recognition (user_id, phone_number, invoice_reference, invoice_file_url, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [req.user.id, phone_number, invoice_reference || null, invoice_file_url]
      );
    }

    await client.query('COMMIT');

    const recognition = result.rows[0];
    res.status(201).json({
      id: recognition.id,
      user_id: recognition.user_id,
      phone_number: recognition.phone_number,
      invoice_reference: recognition.invoice_reference,
      invoice_file_url: recognition.invoice_file_url,
      status: recognition.status,
      created_at: recognition.created_at,
      approved_at: recognition.approved_at,
      message: 'Student recognition submitted successfully. Please wait for admin approval.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// GET /recognition/status - User checks their status
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, user_id, phone_number, invoice_reference, invoice_file_url, status, created_at, approved_at
       FROM student_recognition 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        status: 'not_submitted',
        message: 'No student recognition submitted yet'
      });
    }

    const recognition = result.rows[0];
    res.json({
      id: recognition.id,
      user_id: recognition.user_id,
      phone_number: recognition.phone_number,
      invoice_reference: recognition.invoice_reference,
      invoice_file_url: recognition.invoice_file_url,
      status: recognition.status,
      created_at: recognition.created_at,
      approved_at: recognition.approved_at
    });
  } catch (error) {
    next(error);
  }
});

// PUT /recognition/:id/approve - Admin approves recognition
router.put('/:id/approve', authenticate, authorize('admin', 'superadmin'), async (req, res, next) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if recognition exists
    const recognitionCheck = await client.query(
      'SELECT * FROM student_recognition WHERE id = $1',
      [id]
    );

    if (recognitionCheck.rows.length === 0) {
      throw new Error('Student recognition not found');
    }

    const recognition = recognitionCheck.rows[0];

    // If already approved, return success
    if (recognition.status === 'approved') {
      await client.query('COMMIT');
      return res.json({
        message: 'Student recognition is already approved',
        recognition: {
          id: recognition.id,
          user_id: recognition.user_id,
          phone_number: recognition.phone_number,
          invoice_reference: recognition.invoice_reference,
          invoice_file_url: recognition.invoice_file_url,
          status: recognition.status,
          created_at: recognition.created_at,
          approved_at: recognition.approved_at
        }
      });
    }

    // Update status to approved and set approved_at
    const result = await client.query(
      `UPDATE student_recognition 
       SET status = 'approved',
           approved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    const updatedRecognition = result.rows[0];
    res.json({
      message: 'Student recognition approved successfully',
      recognition: {
        id: updatedRecognition.id,
        user_id: updatedRecognition.user_id,
        phone_number: updatedRecognition.phone_number,
        invoice_reference: updatedRecognition.invoice_reference,
        invoice_file_url: updatedRecognition.invoice_file_url,
        status: updatedRecognition.status,
        created_at: updatedRecognition.created_at,
        approved_at: updatedRecognition.approved_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// PUT /recognition/:id/reject - Admin rejects recognition
router.put('/:id/reject', authenticate, authorize('admin', 'superadmin'), async (req, res, next) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { rejection_reason } = req.body;

    // Check if recognition exists
    const recognitionCheck = await client.query(
      'SELECT * FROM student_recognition WHERE id = $1',
      [id]
    );

    if (recognitionCheck.rows.length === 0) {
      throw new Error('Student recognition not found');
    }

    const recognition = recognitionCheck.rows[0];

    // If already rejected, return success
    if (recognition.status === 'rejected') {
      await client.query('COMMIT');
      return res.json({
        message: 'Student recognition is already rejected',
        recognition: {
          id: recognition.id,
          user_id: recognition.user_id,
          phone_number: recognition.phone_number,
          invoice_reference: recognition.invoice_reference,
          invoice_file_url: recognition.invoice_file_url,
          status: recognition.status,
          created_at: recognition.created_at,
          approved_at: recognition.approved_at
        }
      });
    }

    // If already approved, don't allow rejection
    if (recognition.status === 'approved') {
      throw new Error('Cannot reject an already approved recognition');
    }

    // Update status to rejected
    const result = await client.query(
      `UPDATE student_recognition 
       SET status = 'rejected',
           approved_at = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    const updatedRecognition = result.rows[0];
    res.json({
      message: 'Student recognition rejected successfully',
      recognition: {
        id: updatedRecognition.id,
        user_id: updatedRecognition.user_id,
        phone_number: updatedRecognition.phone_number,
        invoice_reference: updatedRecognition.invoice_reference,
        invoice_file_url: updatedRecognition.invoice_file_url,
        status: updatedRecognition.status,
        created_at: updatedRecognition.created_at,
        approved_at: updatedRecognition.approved_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
