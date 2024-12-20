import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(idToken) {
    
    try {
      
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify your Google client ID here
        });

        const payload = ticket.getPayload();
        return payload; // Returns user information from the token

    } catch (error) {

      throw new Error(error);

    }

}


export {verifyGoogleToken}; 