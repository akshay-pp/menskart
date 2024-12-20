const accountSid = process.env.ACCOUNTSID;
const authToken = process.env.AUTHTOKEN;
const client = require('twilio')(accountSid, authToken);

client.verify.v2.services("VA3ae5c49e0fa1be9a44eaed3956d80af0")
      .verificationChecks
      .create({to: '+917012377442', code: '[Code]'})
      .then(verification_check => console.log(verification_check.status));