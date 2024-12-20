import nodemailer from "nodemailer";

let transporter = nodemailer.createTransport({
    service: `gmail`,
    auth: {
        user: process.env.MAILER_EMAIL,
        pass: process.env.MAILER_PASSWORD
    }
});


//generate otp



//send otp function
const sendOtp = async function (email){

    const generateOtp = function() {
    
        let numbers = `0123456789`;
        let otp = ``;
        for (let i=0; i<6; i++){
            otp+= numbers[Math.floor(Math.random()*10)];
        }
        return otp;
    }
    const generatedOtp = generateOtp();

    let mailOptions = {
        from: process.env.MAILER_EMAIL,
        to: email,
        subject: `Your otp for menskart`,
        text: `Hey, here is your otp for logging into menskart. ${generatedOtp}`
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
    });

    return generatedOtp; 
}



export { sendOtp };