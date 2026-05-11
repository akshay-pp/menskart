import { User } from "../models/user.model.js";
import { sendOtp } from "../utils/nodemailer.js";
import {STATUS_CODES} from '../utils/constants/statusCodes.js';
import { Wallet } from "../models/wallet.model.js";
import { generateReferralCode } from "../utils/idGenerator.js";
import { verifyGoogleToken } from "../utils/verifyGoogleToken.js";


//homepage
export const getHome = async (req,res)=> {

    const user = req.session.user || null;
    const newArrivals = await Product.find({}).populate("category", "name").populate("subcategory", "name").sort({createdAt: -1}).limit(PAGINATION_CONFIG.DEFAULT_LIMIT);
    const bestSellers = await Product.find({}).populate("category", "name").populate("subcategory", "name").sort({stock: 1}).limit(PAGINATION_CONFIG.DEFAULT_LIMIT);
    res.status(STATUS_CODES.SUCCESS).render('index', {user, newArrivals, bestSellers});

}



//get login page
export const getLogin = async (req,res) => {
    res.status(STATUS_CODES.SUCCESS).render("login");
}




//user login
export const loginUser = async (req, res) => {
    
    console.log("request hit")
    const { email, password } = req.body;
    console.log(req.body);

    if(!email || !password){
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "all fields are required" });
    } else {

        try {

            const user = await User.findOne({ email });
      
            if (!user) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "No user found for the email" });
            }

            if(user?.isBlocked){
                return res.status(STATUS_CODES.FORBIDDEN).json({ success: false, error: "You're blocked from accessing the website" });
            }
      
            const isPasswordValid = await user.verifyPassword(password);
      
            if (!isPasswordValid) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "Incorrect password" });
            }
            
            req.session.user = user;
            const wallet = await Wallet.findOneAndUpdate(
                {owner: user._id},
                {$setOnInsert: {balance: 0, transaction: []}},
                {upsert: true, new: true}
            );

            const referralCode = generateReferralCode(req.session.user.fullname);
            await User.findOneAndUpdate(
                { _id: user._id, referralCode: { $exists: false } },
                {$set: {referralCode, referrals: []}},
                {new: true}
            );

            console.log(wallet);

            return res.status(STATUS_CODES.SUCCESS).json({ success: true, message: "Logging you in.." });
            
        } catch (error) {
            console.error(error);
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
        }
    }
  
   
};




//register new user
export const registerUser = async(req,res) => {

    const {fullname, email, password, confirmPassword, referralInput} = req.body;
    console.log(req.body);
    let isEmpty = [fullname, email, password, confirmPassword].some(item => item?.trim() === "")


    if (isEmpty){
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "All fields are required" });
    } else if (password != confirmPassword){
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "passwords doesn't match" });
    }
    else {

        try {
            
            const existingUser = await User.findOne({email});

            if(existingUser){
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "User with email already exists"});
            } else {

                let referredBy;
                if (referralInput) {
                    referredBy = await User.findOne({referralCode: referralInput}, {_id: 1});
                    if (!referredBy){
                        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "Invalid Referral Code"});
                    };
                };

                const user = {fullname, email, password, referredBy: referredBy?._id || null};
                req.session.temp = user;
                const otp = await sendOtp(email);
                const expiry = Date.now()+(30*1000);
                console.log(req.session.temp);     //for debugging
                req.session.otp = {otp, expiry};
                console.log(req.session.otp);     //for debugging
                return res.status(STATUS_CODES.SUCCESS).json({ success: true, message: "otp sent successfully"});
                
            }

        } catch (error) {
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message});
        }

    }
}




//user registration otp validation
export const verifyRegistration = async (req,res) => {
    
    const {otp} = req.body;

    if(req.session.otp.otp && req.session.otp.otp == otp){

        if (req.session.otp.expiry < Date.now()){
            return res.status(STATUS_CODES.FORBIDDEN).json({ success: false, error: "Otp Expired"});
        }
        
        const {fullname, email, password, referredBy} = req.session.temp;
        try {

            const referralCode = generateReferralCode(fullname);
            const user = await User.create({fullname, email, password, referralCode, referredBy});
            const newUser = await User.findById(user._id);
            
            if (!newUser){
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: "error creating user"})
            } else {
                req.session.user = newUser;
                await Wallet.create({owner: user._id, balance: 0, transactions: []});

                if (referredBy) {
                    await User.findByIdAndUpdate(referredBy, {$addToSet: {referrals: user._id }});
                    
                    const newTransactionReferredBy = {
                        amount: 200,
                        direction: 'Credit',
                        source: 'referral',
                        referee: user._id,
                        status: 'success'
                    };
        
                    await Wallet.findOneAndUpdate(
                        {owner: referredBy}, 
                        {
                            $push: {transactions: newTransactionReferredBy},
                            $inc: {balance: 200}
                        }
                    );

                    const newTransactionReferee = {
                        amount: 200,
                        direction: 'Credit',
                        source: 'referral',
                        status: 'success'
                    };

                    await Wallet.findOneAndUpdate(
                        {owner: user._id}, 
                        {
                            $push: {transactions: newTransactionReferee},
                            $inc: {balance: 200}
                        }
                    );
                }
                return res.status(STATUS_CODES.SUCCESS).json({ success:true, message: "otp verified. redirecting...", url: "/"});

            }

        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message})
        }
    }else{
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "Incorrect otp"});
    }

}




//user registration resend otp
export const resendOtp = async(req,res) => {
    try {
        if(!req.session.temp){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error:"unauthorized"});
        
        }else if(req.session?.otp?.expiry > Date.now()) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error:"Please wait for a while..."});
        
        }else{
            const otp = await sendOtp(req.session.temp.email);
            const expiry = Date.now()+(30*1000); 
            req.session.otp = {otp, expiry};

            console.log(`Generated otp : ${otp}`)     //for debugging

            return res.status(STATUS_CODES.SUCCESS).json({ success: true, message: "Otp resent successfully" });
        }
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error:error.message });
    }
}




//---------------------- forgot-password ----------------------//

//fetch email and send otp 
export const forgotPassword = async(req,res) => {

    const {email} = req.body;

    try {

        const user = await User.findOne({email});
        
        if(!user){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "no account associated with this email"});
        }

        const otp = await sendOtp(email);
        const expiry = Date.now()+(60*1000); 
        req.session.email = email;
        req.session.otp = {otp, expiry};
        console.log(req.session.otp);

        return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "otp sent successfully"})


    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error: error.message});
    }

}




//verify otp
export const verifyForgotOtp = async (req,res) => {

    if (req.session?.otp?.otp != req.body.otp){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "incorrrect otp"});
    }

    if (req.session?.otp?.expiry < Date.now()){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "otp expired"});
    }

    if (req.session?.otp?.otp == req.body.otp){
        return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "otp verified"});
    }


}




//reset password
export const resetPassword = async (req,res) => {

    const {newPassword, confirmPassword} = req.body;
    console.log(req.body);
    
    if (newPassword != confirmPassword){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "passwrods doesn't match"});
    }

    const user = await User.findOne({email:req.session.email});
    user.password = newPassword;

    try {
        await user.save();
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "password updated successfully"});
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
    
}



//logout user
export const logoutUser = async(req,res) => {
    if(req.session.user){
        req.session.destroy();
        res.redirect("/");
    }
}



//sign in - sign up with google
export const signUpGoogle = async (req, res) => {

    const {credential} = req.body;

    if(!credential){
        return res.status(400).json({ success: false, error: "No credential"});
    }

    try {
        
        const userInfo = await verifyGoogleToken(credential);
        const user = await User.findOne({email: userInfo.email});
        
        if(user){

            req.session.user = user;
            
        }else{

            const newUser = await User.create({ fullname: userInfo.name, email: userInfo.email, createdWith: "google" });
            req.session.user = newUser;
            console.log(newUser);
        }

        return res.redirect("/");

    } catch (error) {
        return res.status(400).json({ success: false, error});
    }

}