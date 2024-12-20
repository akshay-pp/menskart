import {verifyGoogleToken} from "../utils/verifyGoogleToken.js";
import {User} from "../models/user.model.js";
import {sendOtp} from "../utils/nodemailer.js";
import { Product } from "../models/product.model.js";


//homepage
export const getHome = async (req,res)=> {

    const user = req.session.user || null;
    res.status(200).render('index', {user});

}



//user login
export const loginUser = async (req, res) => {
    
    console.log("request hit")
    const { email, password } = req.body;
    console.log(req.body);

    if(!email || !password){
        return res.status(400).json({ success: false, error: "all fields are required" });
    }else {

        try {

            const user = await User.findOne({ email });
      
            if (!user) {
                return res.status(400).json({ success: false, error: "No user found for the email" });
            }

            if(user?.isBlocked){
                return res.status(403).json({ success: false, error: "You're blocked from accessing the website" });
            }
      
            const isPasswordValid = await user.verifyPassword(password);
      
            if (!isPasswordValid) {
                return res.status(400).json({ success: false, error: "Incorrect password" });
            }
            
            req.session.user = user;
            return res.status(200).json({ success: true, message: "Logging you in.." });
            
        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
  
   
};



//register new user
export const registerUser = async(req,res) => {

    const {fullname, email, password} = req.body;
    console.log(req.body);
    let isEmpty = [fullname,email,password].some(item => item?.trim() === "")

    if (isEmpty){
        res.status(400).json({ success: false, error: "All fields are required" });
    }else{

        try {
            
            const existingUser = await User.findOne({email});

            if(existingUser){
                res.status(400).json({ success: false, error: "User with email already exists"});
            }else{

                const user = {fullname, email, password};
                req.session.temp = user;
                const otp = await sendOtp(email);
                const expiry = Date.now()+(30*1000);
                console.log(req.session.temp);     //for debugging
                req.session.otp = {otp, expiry};
                console.log(req.session.otp);     //for debugging
                return res.status(200).json({ success: true, message: "otp sent successfully"});
                
            }

        } catch (error) {
            res.status(500).json({ success: false, error: error.message});
        }

    }
}

//user registration otp validation
export const verifyRegistration = async (req,res) => {
    
    const {otp} = req.body;

    if(req.session.otp.otp && req.session.otp.otp == otp){

        if (req.session.otp.expiry < Date.now()){
            return res.status(403).json({ success: false, error: "Otp Expired"});
        }
        
        const {fullname, email, password} = req.session.temp;
        try {

            const user = await User.create({fullname, email, password});
            const newUser = await User.findById(user._id);
            
            if(!newUser){
                return res.status(500).json({ success: false, error: "error creating user"})
            }else{
                req.session.user = newUser;
                return res.json({ success:true, message: "otp verified. redirecting...", url: "/"});

            }

        } catch (error) {
            return res.status(500).json({ success: false, error: error.message})
        }
    }else{
        return res.status(400).json({ success: false, error: "Incorrect otp"});
    }

}


//user registration resend otp
export const resendOtp = async(req,res) => {
    try {
        if(!req.session.temp){
            return res.status(400).json({success: false, error:"unauthorized"});
        
        }else if(req.session?.otp?.expiry > Date.now()) {
            return res.status(400).json({success: false, error:"Please wait for a while..."});
        
        }else{
            const otp = await sendOtp(req.session.temp.email);
            const expiry = Date.now()+(30*1000); 
            req.session.otp = {otp, expiry};

            console.log(`Generated otp : ${otp}`)     //for debugging

            return res.status(200).json({ success: true, message: "Otp resent successfully" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error:error.message });
    }
}



//logout user
export const logoutUser = async(req,res) => {

    if(req.session.user){
        req.session.destroy();
        res.redirect("/");
    }

}



//sign in with google
export const signInGoogle = async (req, res) => {
    // console.log(req.body);
    // const {credential} = req.body;

    // if(!credential){
    //     return res.status(400).json({ success: false, error: "No credential"});
    // }

    // try {
        
    //     const userInfo = await verifyGoogleToken(credential);
    //     const user = await User.findOne({email: userInfo.email});
        
    //     if(!user){
    //         return res.status(400).json({success: false, error: "No account found for this email. Please Register"});
    //     }

    //     req.session.user = user;
    //     res.redirect("/");

    // } catch (error) {
    //     return res.status(400).json({ success: false, error});
    // }

}



//sign in -sign up with google
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



//list products
export const getProducts = async(req,res) => {

    const user = req.session.user || null;
    const productdata = await Product.find({ isUnListed: false }).populate("category");

    console.log(productdata);
    res.status(200).render('user-product-list', {user, productdata});
}


//product page
export const getProductPage  = async(req,res) => {

    const {pId} = req.params;
    const user = req.session.user || null;
    const product = await Product.findById(pId).populate("category", "name").populate("subcategory", "name");
    console.log(product);
    res.status(200).render("user-product-page", {product, user});


}



//404 error page
export const errorPage = async (req,res) => {
    
    const user = req.session.user || null;
    res.status(404).render("404", {user});

} 