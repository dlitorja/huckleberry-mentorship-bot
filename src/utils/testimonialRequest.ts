import { Resend } from 'resend';
import { logger } from './logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTestimonialRequest(options: {
	menteeEmail: string;
	menteeName: string;
	instructorName: string;
	sessionNumber: number;
}) {
	const { menteeEmail, menteeName, instructorName, sessionNumber } = options;

	const formUrl = process.env.TESTIMONIAL_FORM_URL || 'https://forms.gle/YOUR_FORM_ID';

	try {
		await resend.emails.send({
			from: process.env.RESEND_FROM_EMAIL!,
			to: menteeEmail,
			subject: `Quick favor for ${instructorName}? Share your experience ✨`,
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #5865F2;">We'd love to hear how it's going with ${instructorName} 💬</h1>
          
          <p>Hi ${menteeName.split('#')[0]},</p>
          
          <p>You’ve completed <strong>${sessionNumber} session${sessionNumber === 1 ? '' : 's'}</strong> with 
          <strong>${instructorName}</strong> — amazing progress! 🎉</p>
          
          <p>Your feedback helps our instructors understand what’s working in their instruction, 
          where it’s helping most, and how to keep improving the mentorship experience for everyone.</p>

          <p>Would you mind sharing a quick note about your experience so far?</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${formUrl}" 
               style="display: inline-block; padding: 15px 32px; background-color: #5865F2; 
                      color: white; text-decoration: none; border-radius: 5px; 
                      font-size: 16px; font-weight: bold;">
              Share Your Experience (2–3 min)
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;"><strong>Helpful prompts:</strong></p>
          <ul style="font-size: 14px; color: #666;">
            <li>What’s improved for you since starting with ${instructorName}?</li>
            <li>What was most valuable in your sessions together?</li>
            <li>Would you recommend ${instructorName}’s mentorship to other artists? Why?</li>
          </ul>
          
          <div style="font-size: 13px; color: #555; background:#f8f9fb; padding:12px 16px; border-radius:8px; margin-top:24px;">
            Your words directly support ${instructorName} and help more mentees find the right guidance. 
            Thanks for being part of the community! ❤️
          </div>
        </div>
      `
		});

		logger.info('Testimonial request sent', { menteeEmail, instructorName, sessionNumber });
		return true;
	} catch (error) {
		logger.error('Failed to send testimonial request', error instanceof Error ? error : new Error(String(error)), {
			menteeEmail,
			instructorName,
		});
		return false;
	}
}


