import axios from "axios";



const SMS_MODE = process.env.SMS_MODE || "stub";



export async function sendSms(to: string, message: string): Promise<void> {

  const timestamp = new Date().toISOString();



  if (SMS_MODE === "stub") {

    console.log(`\n📤 [SMS ${timestamp}]`);

    console.log(`   To: ${to}`);

    console.log(`   Message: ${message}\n`);

    return;

  }



  // Africa's Talking implementation

  try {

    await axios.post(

      "https://api.africastalking.com/version1/messaging",

      new URLSearchParams({

        username: process.env.AT_USERNAME!,

        to,

        message,

        from: process.env.AT_SENDER || "AgroTrack",

      }),

      {

        headers: {

          apiKey: process.env.AT_API_KEY!,

          "Content-Type": "application/x-www-form-urlencoded",

        },

      }

    );

    console.log(`📤 SMS sent to ${to}`);

  } catch (error: any) {

    console.error(`Failed to send SMS:`, error.message);

    throw error;

  }

}



// ============================================================================

// EXPRESS API

// ============================================================================
