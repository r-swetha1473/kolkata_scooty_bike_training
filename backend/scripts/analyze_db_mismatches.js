/**
 * Database Column Mismatch Analyzer
 * 
 * This script analyzes backend code to find:
 * - Missing columns referenced in code but not in schema
 * - Deprecated columns still referenced in code
 * - Tables referenced but not existing
 * 
 * DO NOT AUTO-FIX - Only reports issues
 */

const fs = require('fs');
const path = require('path');

// Schema extracted from migrations (actual PostgreSQL schema)
const schema = {
  profiles: [
    'id', 'email', 'full_name', 'phone', 'avatar_url', 'role', 'password_hash',
    'google_id', 'created_at', 'updated_at', 'total_bookings', 'last_booking_date',
    'weekly_booking_count', 'weekly_reset_date', 'provider_id', 'auth_provider'
  ],
  trainers: [
    'id', 'user_id', 'bio', 'experience_years', 'specialization', 'rating',
    'total_sessions', 'is_active', 'on_duty', 'created_at', 'updated_at'
  ],
  slots: [
    'id', 'trainer_id', 'start_time', 'end_time', 'slot_date', 'capacity',
    'booked_count', 'status', 'is_auto_generated', 'is_visible', 'created_at', 'updated_at'
  ],
  bookings: [
    'id', 'user_id', 'slot_id', 'trainer_id', 'vehicle_id', 'vehicle_type',
    'phone', 'status', 'notes', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
    'created_at', 'updated_at'
  ],
  vehicles: [
    'id', 'name', 'max_per_slot', 'is_active', 'created_at', 'updated_at',
    // Deprecated but may still exist:
    'type', 'vehicle_subtype', 'description'
  ],
  settings: [
    'key', 'value', 'description', 'updated_at', 'updated_by'
  ],
  audit_logs: [
    'id', 'user_id', 'action', 'entity_type', 'entity_id', 'old_data', 'new_data',
    'ip_address', 'created_at'
  ],
  admin_audit_log: [
    'id', 'admin_id', 'action_type', 'entity_type', 'entity_id', 'before_value',
    'after_value', 'details', 'created_at'
  ],
  admins: [
    'id', 'profile_id', 'role', 'password_hash', 'is_active', 'last_login_at',
    'failed_login_attempts', 'locked_until', 'created_by', 'created_at', 'updated_at'
  ],
  student_recognition: [
    'id', 'user_id', 'phone_number', 'invoice_reference', 'invoice_file_url',
    'status', 'created_at', 'approved_at'
  ],
  student_entitlements: [
    'id', 'user_id', 'total_slots', 'used_slots', 'first_booking_date',
    'expiry_date', 'created_at', 'updated_at'
  ],
  slot_vehicle_capacity: [
    'id', 'slot_id', 'vehicle_id', 'capacity', 'created_at', 'updated_at'
  ],
  ratings: [
    'id', 'booking_id', 'trainer_id', 'user_id', 'rating', 'comment',
    'created_at', 'updated_at'
  ]
};

// Deprecated columns (exist in old migrations but should not be used)
const deprecatedColumns = {
  slots: ['electric_capacity', 'petrol_capacity', 'bike_capacity', 'electric_booked', 'petrol_booked', 'bike_booked'],
  vehicles: ['type', 'vehicle_subtype', 'description'], // May still exist but deprecated
  bookings: ['vehicle_type'] // Deprecated in favor of vehicle_id (but still exists in schema)
};

// Schema-code mismatches (code uses different column names than schema)
const schemaMismatches = {
  ratings: {
    'rating_value': 'rating', // Code uses rating_value, schema has rating
    'comments': 'comment'      // Code uses comments, schema has comment
  }
};

// Note: ratings table has a mismatch - code uses rating_value/comments but migration uses rating/comment
// This is a schema-code mismatch that needs to be resolved

// Extract SQL queries from a file
function extractSQLQueries(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const queries = [];
    
    // Match db.query, client.query patterns with SQL strings (including multi-line)
    const patterns = [
      /(?:db|client|pool)\.query\s*\(\s*`([\s\S]*?)`/gm,
      /(?:db|client|pool)\.query\s*\(\s*'([\s\S]*?)'/gm,
      /(?:db|client|pool)\.query\s*\(\s*"([\s\S]*?)"/gm,
    ];
    
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const sql = match[1].trim();
        // Skip if it's just a variable reference or very short
        if (sql.length > 5 && !sql.match(/^\$\d+$/) && !sql.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          queries.push({
            sql: sql,
            file: filePath,
            line: lineNum
          });
        }
      }
    });
    
    // Also extract query variable assignments (let query = `...`)
    const queryVarPattern = /(?:let|const|var)\s+query\s*=\s*`([\s\S]*?)`/gm;
    let match;
    while ((match = queryVarPattern.exec(content)) !== null) {
      const sql = match[1].trim();
      if (sql.length > 5) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        queries.push({
          sql: sql,
          file: filePath,
          line: lineNum
        });
      }
    }
    
    return queries;
  } catch (error) {
    return [];
  }
}

// Parse table and column names from SQL
function parseSQL(sql) {
  const tables = new Set();
  const columns = new Map(); // table -> Set of columns
  
  // Use lowercase for matching
  const sqlLower = sql.toLowerCase();
  
  // Extract table names from FROM, JOIN, INSERT INTO, UPDATE, DELETE FROM
  // Only match actual table names (not single-letter aliases or SQL keywords)
  const validTablePattern = /^[a-z_][a-z0-9_]{2,}$/; // At least 2 characters
  
  const tablePatterns = [
    /\bfrom\s+([a-z_][a-z0-9_]*)\b/gi,
    /\bjoin\s+([a-z_][a-z0-9_]*)\b/gi,
    /\binto\s+([a-z_][a-z0-9_]*)\b/gi,
    /\bupdate\s+([a-z_][a-z0-9_]*)\b/gi,
    /\bdelete\s+from\s+([a-z_][a-z0-9_]*)\b/gi,
  ];
  
  const sqlKeywords = ['select', 'where', 'set', 'values', 'order', 'group', 'having', 'limit', 'offset', 'as', 'on', 'and', 'or', 'not', 'in', 'is', 'null', 'case', 'when', 'then', 'else', 'end', 'if', 'exists', 'left', 'right', 'inner', 'outer', 'cross', 'lateral', 'coalesce', 'filter', 'json', 'jsonb', 'build', 'object', 'agg', 'array', 'distinct', 'union', 'all', 'except', 'intersect'];
  
  tablePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(sqlLower)) !== null) {
      const tableName = match[1].toLowerCase();
      // Skip SQL keywords and single-letter aliases (likely table aliases)
      if (validTablePattern.test(tableName) && !sqlKeywords.includes(tableName) && tableName.length >= 2) {
        tables.add(tableName);
        if (!columns.has(tableName)) {
          columns.set(tableName, new Set());
        }
      }
    }
  });
  
  // Extract table.column patterns (only if table name is valid)
  const tableColumnPattern = /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi;
  let tcMatch;
  while ((tcMatch = tableColumnPattern.exec(sqlLower)) !== null) {
    const tableName = tcMatch[1].toLowerCase();
    const columnName = tcMatch[2].toLowerCase();
    // Skip single-letter table names (likely aliases) and SQL keywords
    if (validTablePattern.test(tableName) && 
        !sqlKeywords.includes(tableName) && 
        !columnName.includes('(') && 
        !['count', 'sum', 'avg', 'max', 'min', 'now', 'current_date', 'interval'].includes(columnName) &&
        columnName.length >= 2) {
      tables.add(tableName);
      if (!columns.has(tableName)) {
        columns.set(tableName, new Set());
      }
      columns.get(tableName).add(columnName);
    }
  }
  
  // Extract columns from SELECT clause (handle aliases)
  const selectMatch = sqlLower.match(/select\s+([\s\S]+?)\s+from/);
  if (selectMatch) {
    const selectClause = selectMatch[1];
    // Split by comma, but be careful with nested functions
    const parts = selectClause.split(',').map(p => p.trim());
    parts.forEach(part => {
      // Remove aliases (AS alias)
      const withoutAlias = part.split(/\s+as\s+/)[0].trim();
      // Extract table.column or just column
        const dotIndex = withoutAlias.indexOf('.');
        if (dotIndex > 0 && dotIndex < withoutAlias.length - 1) {
          const tableName = withoutAlias.substring(0, dotIndex).toLowerCase();
          const columnName = withoutAlias.substring(dotIndex + 1).toLowerCase();
          // Only process valid table names and columns
          if (validTablePattern.test(tableName) && 
              !sqlKeywords.includes(tableName) &&
              !columnName.includes('(') && 
              columnName !== '*' && 
              columnName.length >= 2 &&
              !columnName.startsWith("'") &&
              !sqlKeywords.includes(columnName)) {
            tables.add(tableName);
            if (!columns.has(tableName)) {
              columns.set(tableName, new Set());
            }
            columns.get(tableName).add(columnName);
          }
        } else if (!withoutAlias.includes('(') && withoutAlias !== '*' && withoutAlias.length >= 2) {
        // Just column name - add to all tables in query (but skip JSON keys and SQL keywords)
        const columnName = withoutAlias.toLowerCase();
        // Skip JSON keys (quoted strings), SQL keywords, and single characters
        if (!columnName.startsWith("'") && 
            !columnName.endsWith("'") &&
            !['count', 'sum', 'avg', 'max', 'min', 'now', 'current_date', 'interval', 'case', 'when', 'then', 'else', 'end', 'as', 'where', 'and', 'or', 'not', 'in', 'is', 'null', 'true', 'false', 'exists', 'select', 'from', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'order', 'by', 'having', 'limit', 'offset', 'returning', 'values', 'set', 'update', 'insert', 'delete', 'into', 'json', 'jsonb', 'build', 'object', 'agg', 'array', 'distinct', 'coalesce', 'filter'].includes(columnName) &&
            columnName.length >= 2) {
          tables.forEach(table => {
            // Only add to valid table names
            if (validTablePattern.test(table) && !sqlKeywords.includes(table)) {
              if (!columns.has(table)) {
                columns.set(table, new Set());
              }
              columns.get(table).add(columnName);
            }
          });
        }
      }
    });
  }
  
  // Extract columns from INSERT INTO table (col1, col2, ...)
  const insertMatch = sqlLower.match(/insert\s+into\s+([a-z_][a-z0-9_]+)\s*\(([^)]+)\)/);
  if (insertMatch) {
    const tableName = insertMatch[1].toLowerCase();
    // Only process if valid table name
    if (validTablePattern.test(tableName) && !sqlKeywords.includes(tableName)) {
      const columnList = insertMatch[2];
      tables.add(tableName);
      if (!columns.has(tableName)) {
        columns.set(tableName, new Set());
      }
      columnList.split(',').forEach(col => {
        const columnName = col.trim().toLowerCase();
        // Skip template literals, JSON keys, and invalid column names
        if (columnName.length >= 2 && 
            !columnName.includes('(') && 
            !columnName.includes('$') &&
            !columnName.startsWith("'") &&
            !sqlKeywords.includes(columnName)) {
          columns.get(tableName).add(columnName);
        }
      });
    }
  }
  
  // Extract columns from UPDATE table SET col1 = ..., col2 = ...
  const updateMatch = sqlLower.match(/update\s+([a-z_][a-z0-9_]+)\s+set\s+([^where]+)/);
  if (updateMatch) {
    const tableName = updateMatch[1].toLowerCase();
    // Only process if valid table name
    if (validTablePattern.test(tableName) && !sqlKeywords.includes(tableName)) {
      const setClause = updateMatch[2];
      tables.add(tableName);
      if (!columns.has(tableName)) {
        columns.set(tableName, new Set());
      }
      setClause.split(',').forEach(setItem => {
        const columnPart = setItem.split('=')[0].trim().toLowerCase();
        // Skip template literals, JSON keys, and invalid column names
        if (columnPart.length >= 2 && 
            !columnPart.includes('(') && 
            !columnPart.includes('$') &&
            !columnPart.startsWith("'") &&
            !sqlKeywords.includes(columnPart)) {
          columns.get(tableName).add(columnPart);
        }
      });
    }
  }
  
  return { tables: Array.from(tables), columns };
}

// Scan backend directory for SQL queries
function scanBackend() {
  const backendDir = path.join(__dirname, '..');
  const queries = [];
  
  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules, test files, scripts (to avoid analyzing this script), and non-JS files
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'test' && entry.name !== 'scripts') {
            scanDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          const fileQueries = extractSQLQueries(fullPath);
          queries.push(...fileQueries);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  scanDir(backendDir);
  return queries;
}

// Main analysis
function analyze() {
  console.log('🔍 Scanning backend code for SQL queries...\n');
  
  const queries = scanBackend();
  console.log(`Found ${queries.length} SQL query patterns\n`);
  
  const referencedTables = new Set();
  const referencedColumns = new Map(); // table -> Set of columns
  const queryReferences = new Map(); // table.column -> [queries]
  
  // Parse all queries
  queries.forEach(({ sql, file, line }) => {
    try {
      const parsed = parseSQL(sql);
      parsed.tables.forEach(table => {
        referencedTables.add(table);
        if (!referencedColumns.has(table)) {
          referencedColumns.set(table, new Set());
        }
      });
      
      parsed.columns.forEach((cols, table) => {
        referencedTables.add(table);
        if (!referencedColumns.has(table)) {
          referencedColumns.set(table, new Set());
        }
        cols.forEach(col => {
          referencedColumns.get(table).add(col);
          const key = `${table}.${col}`;
          if (!queryReferences.has(key)) {
            queryReferences.set(key, []);
          }
          queryReferences.get(key).push({ sql, file, line });
        });
      });
    } catch (error) {
      // Skip parsing errors
    }
  });
  
  // Compare with schema
  const missingTables = [];
  const missingColumns = [];
  const deprecatedColumnUsage = [];
  const schemaMismatchIssues = [];
  
  // Check tables (only report if it's a real table name, not an alias, CTE, or SQL keyword)
  const validTablePattern = /^[a-z_][a-z0-9_]{2,}$/;
  const sqlKeywords = ['information_schema', 'pg_constraint', 'pg_proc', 'pg_type'];
  // CTE names that appear in queries (Common Table Expressions)
  const cteNames = ['locked_slot', 'slot_validation', 'booking_insert', 'vehicle_check', 'slot_update', 'nowait'];
  
  referencedTables.forEach(table => {
    // Only check valid table names (at least 2 chars, not SQL system tables, not CTEs)
    if (validTablePattern.test(table) && 
        !schema[table] && 
        !sqlKeywords.includes(table) &&
        !cteNames.includes(table)) {
      const refs = queries.filter(q => {
        const sqlLower = q.sql.toLowerCase();
        // Check if it's used as a real table (FROM/JOIN/INTO/UPDATE), not as a CTE
        const isCTE = sqlLower.includes(`with ${table} as`) || sqlLower.includes(`, ${table} as`);
        return !isCTE && (
          sqlLower.includes(`from ${table} `) || 
          sqlLower.includes(`join ${table} `) ||
          sqlLower.includes(`into ${table} `) ||
          sqlLower.includes(`update ${table} `)
        );
      });
      if (refs.length > 0) {
        missingTables.push({
          table,
          references: refs
        });
      }
    }
  });
  
  // Check columns
  referencedColumns.forEach((cols, table) => {
    if (!schema[table]) {
      return; // Already reported as missing table
    }
    
    const schemaColumns = schema[table];
    const deprecated = deprecatedColumns[table] || [];
    
    cols.forEach(column => {
      const key = `${table}.${column}`;
      const refs = queryReferences.get(key) || [];
      
      // Check for schema-code mismatches first
      const mismatches = schemaMismatches[table];
      if (mismatches && mismatches[column]) {
        const actualColumn = mismatches[column];
        schemaMismatchIssues.push({
          table,
          codeColumn: column,
          schemaColumn: actualColumn,
          references: refs
        });
        return; // Skip further checks for this column
      }
      
      // Check if column exists in schema
      if (!schemaColumns.includes(column) && !deprecated.includes(column)) {
        // Check if it's a common false positive (functions, keywords, template literals, JSON keys, etc.)
        const falsePositives = [
          'count', 'sum', 'avg', 'max', 'min', 'now', 'current_date', 'interval', 
          'case', 'when', 'then', 'else', 'end', 'as', 'where', 'and', 'or', 'not', 
          'in', 'is', 'null', 'true', 'false', 'exists', 'select', 'from', 'join', 
          'left', 'right', 'inner', 'outer', 'on', 'group', 'order', 'by', 'having', 
          'limit', 'offset', 'returning', 'values', 'set', 'update', 'insert', 'delete', 
          'into', 'json', 'jsonb', 'build', 'object', 'agg', 'array', 'distinct', 
          'coalesce', 'filter', 'profile', 'vehicle_name', 'capacity', 'booked',
          'updat', 'pass', 'googl', 'avata', 'book', 'fi', 't', 'p', 's', 'b', 'v',
          'excluded', 'updates', 'al', 'creator', 'creator_admin', 'adminupdates',
          'profileupdates', 'locked_slot', 'slot_validation', 'booking_insert',
          'vehicle_check', 'nowait', 'vc', 'ls', 'vehicle', 'bi', 'sv', 'lateral',
          'svc', 'vehicle_booked', 'case when s', 'coalesce(vehicle_booked',
          'slot_capacity', 'config', 'generation', 'is_visibl', '2)'
        ];
        // Also skip columns that look like template literals, JSON keys, or partial strings
        const isFalsePositive = falsePositives.includes(column) ||
          column.includes('$') ||
          column.includes("'") ||
          column.includes('(') ||
          column.includes(')') ||
          column.includes('::') ||
          column.length < 2;
        
        if (!isFalsePositive) {
          missingColumns.push({
            table,
            column,
            references: refs
          });
        }
      }
      
      // Check if deprecated column is used
      if (deprecated.includes(column)) {
        deprecatedColumnUsage.push({
          table,
          column,
          references: refs
        });
      }
    });
  });
  
  // Generate report
  let report = '# Database Code Mismatch Report\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `**Total SQL Queries Analyzed:** ${queries.length}\n\n`;
  report += '---\n\n';
  
  // Missing tables
  if (missingTables.length > 0) {
    report += '## ❌ Missing Tables\n\n';
    report += 'The following tables are referenced in code but do not exist in the schema:\n\n';
    missingTables.forEach(({ table, references }) => {
      report += `### Table: \`${table}\`\n\n`;
      report += `**Referenced in:**\n`;
      references.slice(0, 5).forEach(ref => {
        const relativePath = path.relative(path.join(__dirname, '..', '..'), ref.file);
        report += `- \`${relativePath}\` (line ${ref.line})\n`;
      });
      if (references.length > 5) {
        report += `- ... and ${references.length - 5} more references\n`;
      }
      report += '\n';
    });
  } else {
    report += '## ✅ All Referenced Tables Exist\n\n';
  }
  
  // Missing columns
  if (missingColumns.length > 0) {
    report += '## ❌ Missing Columns\n\n';
    report += 'The following columns are referenced in code but do not exist in the schema:\n\n';
    
    // Group by table
    const byTable = {};
    missingColumns.forEach(({ table, column, references }) => {
      if (!byTable[table]) {
        byTable[table] = [];
      }
      byTable[table].push({ column, references });
    });
    
    Object.keys(byTable).sort().forEach(table => {
      report += `### Table: \`${table}\`\n\n`;
      byTable[table].forEach(({ column, references }) => {
        report += `- **Column:** \`${column}\`\n`;
        report += `  **Referenced in:**\n`;
        references.slice(0, 3).forEach(ref => {
          const relativePath = path.relative(path.join(__dirname, '..', '..'), ref.file);
          report += `  - \`${relativePath}\` (line ${ref.line})\n`;
        });
        if (references.length > 3) {
          report += `  - ... and ${references.length - 3} more references\n`;
        }
        report += '\n';
      });
    });
  } else {
    report += '## ✅ All Referenced Columns Exist\n\n';
  }
  
  // Schema-code mismatches
  if (schemaMismatchIssues.length > 0) {
    report += '## ⚠️ Schema-Code Mismatches\n\n';
    report += 'The following columns are used in code but have different names in the schema:\n\n';
    
    // Group by table
    const byTable = {};
    schemaMismatchIssues.forEach(({ table, codeColumn, schemaColumn, references }) => {
      if (!byTable[table]) {
        byTable[table] = [];
      }
      byTable[table].push({ codeColumn, schemaColumn, references });
    });
    
    Object.keys(byTable).sort().forEach(table => {
      report += `### Table: \`${table}\`\n\n`;
      byTable[table].forEach(({ codeColumn, schemaColumn, references }) => {
        report += `- **Code uses:** \`${codeColumn}\` → **Schema has:** \`${schemaColumn}\`\n`;
        report += `  **Referenced in:**\n`;
        references.slice(0, 5).forEach(ref => {
          const relativePath = path.relative(path.join(__dirname, '..', '..'), ref.file);
          report += `  - \`${relativePath}\` (line ${ref.line})\n`;
        });
        if (references.length > 5) {
          report += `  - ... and ${references.length - 5} more references\n`;
        }
        report += '\n';
      });
    });
  }
  
  // Deprecated columns
  if (deprecatedColumnUsage.length > 0) {
    report += '## ⚠️ Deprecated Columns Still in Use\n\n';
    report += 'The following deprecated columns are still referenced in code:\n\n';
    
    // Group by table
    const byTable = {};
    deprecatedColumnUsage.forEach(({ table, column, references }) => {
      if (!byTable[table]) {
        byTable[table] = [];
      }
      byTable[table].push({ column, references });
    });
    
    Object.keys(byTable).sort().forEach(table => {
      report += `### Table: \`${table}\`\n\n`;
      byTable[table].forEach(({ column, references }) => {
        report += `- **Column:** \`${column}\` (DEPRECATED)\n`;
        report += `  **Referenced in:**\n`;
        references.slice(0, 5).forEach(ref => {
          const relativePath = path.relative(path.join(__dirname, '..', '..'), ref.file);
          report += `  - \`${relativePath}\` (line ${ref.line})\n`;
        });
        if (references.length > 5) {
          report += `  - ... and ${references.length - 5} more references\n`;
        }
        report += '\n';
      });
    });
  } else {
    report += '## ✅ No Deprecated Columns in Use\n\n';
  }
  
  // Summary
  report += '---\n\n';
  report += '## Summary\n\n';
  report += `- **Missing Tables:** ${missingTables.length}\n`;
  report += `- **Missing Columns:** ${missingColumns.length}\n`;
  report += `- **Schema-Code Mismatches:** ${schemaMismatchIssues.length}\n`;
  report += `- **Deprecated Columns in Use:** ${deprecatedColumnUsage.length}\n\n`;
  
  if (missingTables.length === 0 && missingColumns.length === 0 && deprecatedColumnUsage.length === 0 && schemaMismatchIssues.length === 0) {
    report += '✅ **No mismatches found!** All referenced tables and columns exist in the schema.\n';
  } else {
    report += '⚠️ **Action Required:** Please review the mismatches above and update code or schema accordingly.\n\n';
    report += '**Notes:**\n';
    report += '- Schema-code mismatches indicate code uses different column names than the database schema\n';
    report += '- Deprecated columns should be removed from code and replaced with new implementations\n';
    report += '- Missing columns may need to be added to the schema or removed from code\n';
  }
  
  return report;
}

// Run analysis
if (require.main === module) {
  try {
    const report = analyze();
    const reportPath = path.join(__dirname, '..', '..', 'DB_CODE_MISMATCH_REPORT.md');
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log('✅ Analysis complete!');
    console.log(`📄 Report saved to: ${reportPath}\n`);
    console.log(report);
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { analyze, parseSQL, extractSQLQueries };
