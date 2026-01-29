import { User } from "../models/user.model.js";

export const userVerify = async (req,res,next) => {

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');


    const jsonPath = ['/cart', '/wishlist'];

    if (!req.session.user){

        if (jsonPath.some(path => req.path.startsWith(path))  && req.method != "GET"){
            return res.status(400).json({success: false, error: "not logged in. please login", redirect: "/api/user/login?error=not-logged-in"});
        }

        return res.redirect('/api/user/login?error=not-logged-in');
        
    }

    try {
            
        const user = await User.findById(req.session.user._id);
        
        if (user?.isBlocked){
            
            req.session.destroy();
            return res.redirect("/?error=blocked");

        }else{
            req.session.user = user;
            next();
        }
    } catch (error) {
        return res.status(500).json({success: false, error:error.message});
    }

}



export const adminVerify = (req,res,next) => {

    res.set('Cache-Control', 'no-cache, must-revalidate, private');
    
    if (req.session?.user && req.session.user.role == "admin"){
        next();
    }else{
        res.redirect("/");
    }

}