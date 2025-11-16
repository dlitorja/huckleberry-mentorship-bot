import { Resend } from 'resend';

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
			subject: `How's your mentorship going with ${instructorName}? 🎨`,
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #5865F2;">We'd love to hear from you! 💬</h1>
          
          <p>Hi ${menteeName.split('#')[0]},</p>
          
          <p>You've completed <strong>${sessionNumber} sessions</strong> with 
          <strong>${instructorName}</strong> – that's awesome progress! 🎉</p>
          
          <p>We're always looking to improve, and your feedback means the world to us. 
          Would you mind sharing your experience so far?</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${formUrl}" 
               style="display: inline-block; padding: 15px 32px; background-color: #5865F2; 
                      color: white; text-decoration: none; border-radius: 5px; 
                      font-size: 16px; font-weight: bold;">
              Share Your Experience (2 min)
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            <strong>We'd love to know:</strong>
          </p>
          <ul style="font-size: 14px; color: #666;">
            <li>How has the mentorship helped you improve?</li>
            <li>What's been most valuable to you?</li>
            <li>Would you recommend it to other artists?</li>
          </ul>
          
          <p style="font-size: 13px; color: #999; margin-top: 40px;">
            Your feedback helps us improve and helps other artists decide if our 
            mentorships are right for them. Thank you for being part of our community! ❤️
          </p>
        </div>
      `
		});

		console.log(`✅ Testimonial request sent to ${menteeEmail}`);
		return true;
	} catch (error) {
		console.error('Failed to send testimonial request:', error);
		return false;
	}
}


