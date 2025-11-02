import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SlotConfig {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  intervalMinutes: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { date } = await req.json().catch(() => ({ date: null }));
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const config: SlotConfig = {
      startHour: 9,
      startMinute: 0,
      endHour: 21,
      endMinute: 0,
      intervalMinutes: 30,
    };

    const slots = [];
    let currentTime = new Date(targetDate);
    currentTime.setHours(config.startHour, config.startMinute, 0, 0);

    const endTime = new Date(targetDate);
    endTime.setHours(config.endHour, config.endMinute, 0, 0);

    while (currentTime < endTime) {
      const slotStart = new Date(currentTime);
      currentTime.setMinutes(currentTime.getMinutes() + config.intervalMinutes);
      const slotEnd = new Date(currentTime);

      slots.push({
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        slot_date: targetDate.toISOString().split('T')[0],
        capacity: 1,
        booked_count: 0,
        status: 'available',
        is_auto_generated: true,
        trainer_id: null,
      });
    }

    const { data: existingSlots, error: checkError } = await supabase
      .from('slots')
      .select('id')
      .eq('slot_date', targetDate.toISOString().split('T')[0])
      .is('trainer_id', null)
      .eq('is_auto_generated', true)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (existingSlots && existingSlots.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Slots already generated for this date',
          date: targetDate.toISOString().split('T')[0],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data, error } = await supabase
      .from('slots')
      .insert(slots)
      .select();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${slots.length} slots for ${targetDate.toISOString().split('T')[0]}`,
        slotsCreated: slots.length,
        date: targetDate.toISOString().split('T')[0],
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error generating slots:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
