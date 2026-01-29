import {Types} from "mongoose";
import { verifyGoogleToken } from "../utils/verifyGoogleToken.js";
import { User } from "../models/user.model.js";
import { sendOtp, sendOrderConfirmation } from "../utils/nodemailer.js";
import {razorpay, verifySign} from "../utils/razorpay.js";
import { Product } from "../models/product.model.js";
import {Category} from "../models/category.model.js";
import { Address } from "../models/address.model.js";
import { Cart } from "../models/cart.model.js";
import { Order } from "../models/order.model.js";
import { Wishlist } from "../models/wishlist.model.js";
import {Coupon} from "../models/coupon.model.js";
import {Offer} from "../models/offer.model.js";


//homepage
export const getHome = async (req,res)=> {

    const user = req.session.user || null;
    const newArrivals = await Product.find({}).populate("category", "name").populate("subcategory", "name").sort({createdAt: -1}).limit(5);
    const bestSellers = await Product.find({}).populate("category", "name").populate("subcategory", "name").sort({stock: 1}).limit(10);
    res.status(200).render('index', {user, newArrivals, bestSellers});

}



export const getLogin = async (req,res) => {

    res.status(200).render("login");

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

    const {fullname, email, password, confirmPassword} = req.body;
    console.log(req.body);
    let isEmpty = [fullname, email, password, confirmPassword].some(item => item?.trim() === "")

    if (isEmpty){
        return res.status(400).json({ success: false, error: "All fields are required" });
    }else if (password != confirmPassword){
        return res.status(400).json({ success: false, error: "passwords doesn't match" });
    }
    else{

        try {
            
            const existingUser = await User.findOne({email});

            if(existingUser){
                return res.status(400).json({ success: false, error: "User with email already exists"});
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



//user profile
export const getProfile = async (req,res) => {

    // if (!req.session.user){

    //     const address = null;
    //     return res.render("profile", {address});

    // }else if (req.session.user){
        res.set('Cache-Control', 'no-store');
        try {

            const address = await Address.find({owner: req.session.user._id})

            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page-1) * limit;

            const totalOrders = await Order.countDocuments();
            const totalPages = Math.ceil(totalOrders/limit);

            const orders = await Order.aggregate ([
                
                {$match: {owner: req.session.user._id}},
                {$sort: {createdAt: -1}},
                {$unwind: "$orderItems"},
                {$sort: {createdAt: -1}},
                {$lookup: {
                    from: "products",
                    localField: "orderItems.product",
                    foreignField: "_id",
                    as: "orderItems.productData"
                }},
                {$unwind: "$orderItems.productData"},
                {$skip: skip},
                {$limit: limit}

            ])

            console.log(orders);

            return res.render("profile", {address, orders, page, totalPages});
        
        } catch (error) {
    
            return res.status(500).json({success: false, error: error.message});
        
        }

    // }

}




//---------------------- forgot-password ----------------------//


//fetch email and send otp 
export const forgotPassword = async(req,res) => {

    const {email} = req.body;

    try {

        const user = await User.findOne({email});
        
        if(!user){
            return res.status(400).json({success:false, error: "no account associated with this email"});
        }

        const otp = await sendOtp(email);
        const expiry = Date.now()+(60*1000); 
        req.session.email = email;
        req.session.otp = {otp, expiry};
        console.log(req.session.otp);

        return res.status(200).json({success:true, message: "otp sent successfully"})


    } catch (error) {
        return res.status(500).json({success:false, error: error.message});
    }

}


//verify otp
export const verifyForgotOtp = async (req,res) => {

    if (req.session?.otp?.otp != req.body.otp){
        return res.status(400).json({success:false, error: "incorrrect otp"});
    }

    if (req.session?.otp?.expiry < Date.now()){
        return res.status(400).json({success:false, error: "otp expired"});
    }

    if (req.session?.otp?.otp == req.body.otp){
        return res.status(200).json({success:true, message: "otp verified"});
    }


}


//reset password
export const resetPassword = async (req,res) => {

    const {newPassword, confirmPassword} = req.body;
    console.log(req.body);
    
    if (newPassword != confirmPassword){
        return res.status(400).json({success: false, error: "passwrods doesn't match"});
    }

    const user = await User.findOne({email:req.session.email});
    user.password = newPassword;

    try {
        await user.save();
        return res.status(200).json({success: true, message: "password updated successfully"});
    } catch (error) {
        return res.status(500).json({success: false, error: error.message});
    }
    
}


//--------------------------------------------//





//------------------- cart operations -------------------//

//get cart page
export const getCart = async (req,res) => {

    const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product', 'productname price images stock maxQuantity');
    return res.render("cart", {cart});

}


//add to cart
export const addToCart = async (req,res) => {

    const productId = req.body.productId;
    const quantity = req.body.quantity || 1;

    
    try {

        const product = await Product.findById(productId);

        // validations

        if(!product){
            return res.status(500).json({success: false, error: "error fetching product"});
        }

        if(quantity > product.maxQuantity){
            return res.status(400).json({success: false, error: `Maximum quantity for ${product.productname} is ${product.maxQuantity}`});
        }

        if(quantity > product.stock){
            return res.status(400).json({success: false, error: `Sorry! Not enough stock`});
        }

        if(product.stock <= 0){
            return res.status(500).json({success: false, error: "Product out of stock"});
        }

        // validations - end


        let cart;
        try {

            cart = await Cart.findOne({owner: req.session.user._id});

        } catch (error) {

            return res.status(500).json({success: false, error: error.message});

        }

        // create cart and add product if no existing cart

        if(!cart){

            cart = new Cart({

                owner: req.session.user._id,
                items: [
                    {
                        product: productId,
                        price: product.price,
                        quantity
                    }
                ]
            });

            await cart.save();
            return res.status(201).json({success: true, message: "Cart created and product added", cart});
        
        }
        
        // 
        

        // if product is already in cart

        const existingProduct = cart.items.find(item => item.product.toString() == productId)
        if (existingProduct) {
            
            return res.status(200).json({success: false, error: "Item already in cart"});
        
        } else {
        
            const cartItem = {product: productId, price: product.price, quantity};
            cart.items.push(cartItem);
        
        }


        await cart.save();



        // if added from wishlist, remove the product from wishlist
        if (req.body.referer == "wishlist") {

            try {

                const wishlist = await Wishlist.findOne({owner: req.session.user._id});
                wishlist.products = wishlist.products.filter(item => item.toString() != productId);
                await wishlist.save();

            } catch (error) {

                return res.status(500).json({success: false, error: error.message});

            }
        }


        return res.status(200).json({success: true, message: `${product.productname} has been added to the cart`, cart});
        
        
    } catch (error) {
        return res.status(500).json({success: false, error: error.message});
    }

}


//remove from cart
export const removeFromCart = async(req,res) => {

    const {cartItemId} = req.body;
    try {
        
        const cart = await Cart.findOne({owner: req.session.user._id});
        if(!cart){

            return res.status(400).json({success: false, error: "Cart not found"});

        }

        if (cart.items.find(item => item._id.toString() == cartItemId)){

            try {
                cart.items = cart.items.filter(item => item._id.toString() != cartItemId);
                await cart.save();
                return res.status(200).json({success: true, message: "Product successfully removed from cart", total:cart.totalPrice});

            } catch (error) {
                console.log({cartItemId, itemId: item._id})
                return res.status(500).json({success: false, error: error.message});

            }

        }else{

            return res.status(400).json({success: false, error: "Cart item not found"});

        }
    } catch (error) {

        return res.status(500).json({success:false, error : error.message});

    }

}

//update quantity
export const updateQuantity = async(req,res) => {

    const {itemId} = req.params;
    const {quantity} = req.body;

    try {
    
        const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product');
        let item = cart.items.find(item => item._id == itemId);
        console.log(item);

        if (item.product.stock < quantity) {
            return res.status(400).json({success: false, error: "Not enough stock" });
        }

        if (quantity > item.product.maxQuantity) {
            return res.status(400).json({success: false, error: `limited to ${product.maxQuantity} per user`});
        }
         
        item.quantity = quantity;
        let lastUpdatedQuantity = Math.min(quantity, item.product.stock)
        await cart.save();
        return res.status(200).json({success: true, message: "Quantity updated", lastUpdatedQuantity})

    } catch (error) {

        return res.status(500).json({success: false, error: error.message});
    
    }

}

//--------------------------------------------//






//------------------- wishlist operations -------------------------//

//get wishlist
export const getWishlist = async(req,res) => {

    try {
        
        const wishlist = await Wishlist.findOne({owner: req.session.user._id}).populate('products');

        if (!wishlist || wishlist.products.length == 0){
            return res.render("wishlist", {wishlist, isEmpty: true});
        }

        return res.render("wishlist", {wishlist, isEmpty: false});

    } catch (error) {
        return res.status(500).json({success: false, error: error.message});
    }
}



//add to wishlist
export const addToWishlist = async(req,res) => {

    const {productId} = req.params;

    console.log({path: req.path});

    try {
        
        const product = await Product.findById(productId);
        console.log('product query success ✅');

        if (!product){
            return res.status(400).json({success: false, error: "Product doesn't exist"});
        }

        let wishlist = await Wishlist.findOne({owner: req.session.user._id});
        console.log('wishlist query success ✅');

        if (!wishlist){
            wishlist = new Wishlist({
                owner: req.session.user._id
            });
        }

        if (wishlist.products.find(item => item.toString() == productId)){
            return res.status(400).json({success: false, error: "Product already exists in wishlist"});
        }

        wishlist.products.push(productId);
        await wishlist.save();

        return res.status(200).json({success: true, isAdded: true, message: "Product added to wishlist"});
        

    } catch (error) {

        return res.status(500).json({success: false, error: error.message});
    
    }

}


//remove from wishlist
export const removeFromWishlist = async (req,res) => {

    const {productId} = req.params;

    try {

        const wishlist = await Wishlist.findOne({owner: req.session.user._id});
        
        //validations
        wishlist.products = wishlist.products.filter(item => item.toString() != productId);
        await wishlist.save();
        
        return res.status(200).json({success: true, isRemoved: true, message: "Product removed from wishlist"});

    }catch (error){
        
        return res.status(500).json({success: false, error: error.message});
    }
}



//offer operations







//------------------- order operations -------------------------//


// get checkout page

export const getCheckout = async(req,res) => {

    let cart, address, user;
    try {
        [cart, address, user] = await Promise.all([
            Cart.findOne({owner: req.session.user._id}).populate('items.product', 'productname price images'),
            Address.find({owner: req.session.user._id}),
            User.findById(req.session.user._id,{couponsUsed: 1, _id: 0})
        ]);

        if(!cart) {
            return res.status(404).json({success: false, error: "Cart not found."});
        }

        if(!user) {
            return res.status(404).json({success: false, error: "User not found."});
        }

    } catch (err) {
        return res.status(500).json({success: false, error: "Database error", err});
    }
    

    if (!cart.items.length) {
        return res.status(400).json({success: false, error: 'Nothing to checkout… not even good intentions!'});
    } else {

        cart.items.forEach(item => {
            if(item.quantity > item.product.maxQuantity){
                return res.status(400).json({success: false, error: `maximum quantity for ${item.product.productname} is ${item.product.maxQuantity}`})
            }
            if (item.product.stock < item.quantity ){
                return res.status(400).json({success: false, error: `not enough stock for ${item.product.productname}`});
            }
        })

    }
    
    const couponsUsed = user.couponsUsed.map(item => item.coupon);
    const coupons = await Coupon.find(
        {
            $and: [
                {couponActive: true},
                {validFrom: {$lte: new Date()}},
                {expiry: {$gte: new Date()}},
                {$expr: {$lt: ['$usage', '$maxUsage']}},
                {minimumCartValue: {$lte: cart.totalPrice}}
            ] 
        },
        
        {
            code: 1, description: 1, isPercent: 1, couponAmount: 1, maxDiscount: 1, expiry: 1
        }
    ).sort({createdAt: -1}).lean();

    const usableCoupons = coupons.filter(coupon => !couponsUsed.includes(coupon.code));

    usableCoupons.forEach(coupon => {
        
        let discount;
        if (coupon.isPercent) {
            let percentDiscount = cart.totalPrice*(coupon.couponAmount/100);
            discount = percentDiscount > coupon.maxDiscount ?  coupon.maxDiscount : percentDiscount;
        } else {
            discount = coupon.couponAmount;
        }
        coupon.discount = discount;

    });


    let couponInfo = req.session.couponInfo || null;
    res.render("checkout", {cart, address, couponInfo, coupons, usableCoupons, couponsUsed});

    // try {
        
    //     const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product', 'productname price images');
    //     const address = await Address.find({owner: req.session.user._id});
    //     return res.render("checkout", {cart, address});



    // } catch (error) {
    //     return res.status(500).json({success: false, error: error.message});
    // }

}




//check if coupon is valid
export const isCouponValid = async(req,res) => {

    console.log(req.body);
    
    try {

        const regexedCode = new RegExp(`^${req.body.couponCode}$`, "i"); 

        const cart = await Cart.findOne(
            {owner: req.session.user._id},
            { totalPrice: 1, _id: 0 }
        );

        const user = await User.findById(
            req.session.user._id,
            {couponsUsed: 1, _id: 0}
        );

        const coupon = await Coupon.findOne(
            {
                $and: [
                    {code: regexedCode},
                    {couponActive: true},
                    {validFrom: {$lt: new Date()}},
                    {expiry: {$gt: new Date()}},
                    {$expr: {$lt: ['$usage', '$maxUsage']}},
                    {minimumCartValue: {$lte: cart.totalPrice}}
                ] 
            }, 
        
            {
                code: 1, description: 1, isPercent: 1, couponAmount: 1, maxDiscount: 1, expiry: 1
            }

        ).lean();

        console.log({coupon});

        if (coupon) {

            let discount;
            if (coupon.isPercent) {
                let percentDiscount = cart.totalPrice*(coupon.couponAmount/100);
                discount = percentDiscount > coupon.maxDiscount ?  coupon.maxDiscount : percentDiscount;
            } else {
                discount = coupon.couponAmount;
            }

            coupon.discount = discount;
            return res.status(200).json({success: true, coupon});

        } else {
            return res.status(400).json({success: false, error: "Coupon invalid"});
        }

    } catch (error) {
        return res.status(500).json({success: false, error: error.message});
    }

    
}




//obsolete
// export const applyCoupon = async (req, res) => {
    
//     const coupon = req.body.coupon.toUpperCase();
//     const validCoupon = await Coupon.findOne({code: coupon});
//     const cart = await Cart.findOne({owner: req.session.user._id});


//     ///validations
//     if(coupon == req.session?.couponInfo?.coupon){
//         return res.status(400).json({success: false, error: "Coupon already applied!"});
//     }

//     if(!validCoupon){
//         return res.status(400).json({success: false, error: "Coupon invalid"});
//     }

//     if(!validCoupon.couponActive || validCoupon.usage >= validCoupon.maxUsage){
//         return res.status(400).json({success: false, error: "This coupon is no more active"});
//     }

//     //minimum cart value check
//     if(validCoupon.minimumCartValue > cart.totalPrice){
//         return res.status(400).json({success: false, error: `Minimum cart value is ₹${validCoupon.minimumCartValue}`});
//     }

//     if(validCoupon.validFrom > Date.now()){
//         return res.status(400).json({success: false, error: "This coupon is invalid"});
//     }

//     if(validCoupon.expiry < Date.now()){
//         return res.status(400).json({success: false, error: "This coupon is expired"});
//     }

//     ///user coupon applied or not
//     const userCouponInfo = await User.findById(req.session.user._id, {couponsUsed: 1});

//     const hasUsedCoupon = userCouponInfo.couponsUsed.some(coupon => {
//         return coupon.couponId.toString() == validCoupon._id.toString() && coupon.coupon == validCoupon.code;
//     })

//     if(hasUsedCoupon){
//         return res.status(400).json({success: false, error: "You have already used this coupon"});
//     }

    
//     //discount calculation
//     let discount, discountedPrice, totalPrice = cart.totalPrice;

//     if(validCoupon.isPercent){
//         let calculated = +((validCoupon.couponAmount/100) * cart.totalPrice).toFixed();
//         discount = Math.min(calculated, validCoupon.maxDiscount);
//     }else{
//         discount = validCoupon.couponAmount;
//     }

//     discountedPrice = totalPrice - discount;
    
//     req.session.couponInfo = {
//         couponId: validCoupon._id,
//         coupon: validCoupon.code, discount
//     };


//     return res.status(200).json({success: true, message: "Coupon applied successfully", discount, totalPrice, discountedPrice});

// };




export const createOrder = async(req, res) => {

    const {address, paymentMethod} = req.body;
    
    if (!address){
        return res.status(400).json({success: false, error: "Choose an address to proceed"});
    }

    if(!paymentMethod){
        return res.status(400).json({success: false, message: "Choose a payment method to proceed"});
    }
    

    const cart = await Cart.findOne(
            {owner: req.session.user._id},
            { totalPrice: 1, _id: 0 }
    );

    const user = await User.findById(
            req.session.user._id,
            {couponsUsed: 1, _id: 0}
    );



    let couponInfo;
    if (req.body.coupon) {

        couponInfo = JSON.parse(req.body.coupon);

        try {

            console.log({coupon: couponInfo}); 
            let coupon_ = await Coupon.findById(couponInfo.id);
            console.log({coupon_}); 

            const coupon = await Coupon.findOne(
                {
                    $and: [
                        {_id: couponInfo.id},
                        {couponActive: true},
                        {validFrom: {$lte: new Date()}},
                        {expiry: {$gte: new Date()}},
                        {$expr: {$lt: ['$usage', '$maxUsage']}},
                        {minimumCartValue: {$lte: cart.totalPrice}}
                    ]
                },
            
                {
                    code: 1, isPercent: 1, couponAmount: 1, maxDiscount: 1
                }

            ).lean();

            if (coupon) {

                let discount;
                if (coupon.isPercent) {
                    let percentDiscount = cart.totalPrice*(coupon.couponAmount/100);
                    discount = percentDiscount > coupon.maxDiscount ?  coupon.maxDiscount : percentDiscount;
                } else {
                    discount = coupon.couponAmount;
                }

                couponInfo = {
                    couponId: coupon._id,
                    couponCode: coupon.code,
                    discount
                };                

            } else {
                return res.status(400).json({success: false, error: "Coupon invalid"});
            }

        } catch (err) {
            return res.status(500).json({success: false, error: err.message});
        }

    } else {
        couponInfo = null;
    }

    req.session.couponInfo = couponInfo;


    try {

        const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product');
        const errors = [];
        


        //validations
        if (!cart.items.length){
            errors.push("Empty cart");
        }

        cart.items.forEach(item => {
            
            if(item.quantity > item.product.maxQuantity){
                errors.push(`maximum quantity for ${item.product.productname} is ${item.product.maxQuantity}`)
            }
    
            if (item.product.stock < item.quantity ){
                errors.push(`not enough stock for ${item.product.productname}`);
            }
    
        })

        console.log("validations check ✅");



        
        if (errors.length) {
            return res.status(400).json({success: false, error: errors});

        } else {

            const newOrder = new Order({

                owner : req.session.user._id,
                orderItems : cart.items.map(item => ({product: item.product, price: item.price, quantity: item.quantity})),
                paymentInfo: {
                    status : "pending",
                    mode : paymentMethod
                },
                address : address,
                couponInfo

            })
            console.log("new order object creation check ✅");

            

            //if cod, create order
            let orderConfirm = false, responseJson;
            if(paymentMethod == "cash-on-delivery"){
                
                newOrder.orderStatus = "confirmed";
                newOrder.orderItems.forEach(item => item.status = "confirmed");
                await newOrder.save();
                orderConfirm = true;
                responseJson = {
                    success: true,
                    redirectUrl: `/api/user/order-confirmation?orderId=${newOrder._id}`
                }

            } else if (paymentMethod == "razorpay"){

                newOrder.orderStatus = "created";
                newOrder.orderItems.forEach(item => item.status = "created");
                await newOrder.save();
                req.session.tempOrderId = newOrder._id;
                const razorpayOrder  = await razorpay.orders.create({
                    amount: newOrder.totalPrice*100,
                    currency: "INR",
                    receipt: `receipt#${newOrder._id.toString()}`,
                    payment_capture: 1
                })

                console.log({razorpayOrder});
                responseJson = {
                    success: true,
                    razorpayOrder,
                    prefill: {
                        name: req.session.user.fullname,
                        email: req.session.user.email,
                        contact: req.session.user.phone
                    },
                    key: process.env.RAZORPAY_KEY_ID
                };

            }
            //wallet logic here in the else part
            //paypal if possible
            

            //post- order tasks
            if(orderConfirm === true){

                //update product quantity
                for (const item of cart.items) {

                    const product = await Product.findById(item.product._id); 
                    product.stock -= item.quantity;
                    await product.save();

                }

                console.log("stock updation check ✅");


                //empty cart
                cart.items = [];
                await cart.save();
                console.log("cart emptied check ✅")



                //update coupon info - update coupon used by user and increment coupon usage
                if (couponInfo) {

                    let couponUsed = {
                        couponId: couponInfo.couponId,
                        coupon: couponInfo.couponCode
                    };

                    await User.findByIdAndUpdate(
                        req.session.user._id,
                        {$addToSet: {couponsUsed: couponUsed}}
                    );

                    await Coupon.findByIdAndUpdate(
                        couponInfo.couponId, 
                        {$inc: {usage: 1}}
                    );

                }

                console.log("coupon info updated on user side check ✅")



                //send order confirmation email
                await sendOrderConfirmation(req.session.user.email, newOrder);
                console.log("email sent check ✅");



            }

            return res.status(201).json(responseJson);

        }
        
    } catch (error) {

        console.log({error});
        return res.status(500).json({success: false, error: error.message});

    }
}



export const verifyRazorpay = async (req, res) => {

    console.log({razorpay_response : req.body});
    const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body;
    
    const isVerified = verifySign (
        
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        process.env.RAZORPAY_KEY_SECRET

    );

    if (isVerified.success) {

        const newOrder = await Order.findById(req.session.tempOrderId);
        
        //update order and payment status
        newOrder.orderStatus = "confirmed";
        newOrder.orderItems.forEach(item => item.status = "confirmed");
        newOrder.paymentInfo.status = "completed";
        newOrder.paymentInfo.razorpayInfo = {

            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
        
        };
        
        await newOrder.save();
        console.log({newOrder, verified: true});

        //post-order tasks

        // 1- update stock
        const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product');
        for (const item of cart.items) {

            const product = await Product.findById(item.product._id); 
            product.stock -= item.quantity;
            await product.save();

        }
        console.log("stock updation check - razorpay ✅");


        // 2- empty cart
        cart.items = [];
        await cart.save();
        console.log("cart emptied - razorpay ✅");


        // 3- update coupon info 
        if (req.session.couponInfo) {

            let couponUsed = {
                couponId: req.session.couponInfo.couponId,
                coupon: req.session.couponInfo.couponCode
            };

            await User.findByIdAndUpdate(
                req.session.user._id,
                {$addToSet: {couponsUsed: couponUsed}}
            );

            await Coupon.findByIdAndUpdate(
                req.session.couponInfo.couponId, 
                {$inc: {usage: 1}}
            );

        }

        await sendOrderConfirmation(req.session.user.email, newOrder);

        return res.json({success: true, redirectUrl: `/api/user/order-confirmation?orderId=${newOrder._id}&status=success`})

    } else {

        // 1- mark order as payment-pending
        const newOrder = await Order.findById(req.session.tempOrderId);
        newOrder.paymentInfo.status = "pending";

        // 2- payment-status is pending
        // 3- 
        return res.json({success: false, redirectUrl: `/api/user/order-confirmation?status=error`})

    }

}




export const orderStatus = async (req, res) => {
    
    console.log(req.query);

    if (req.query.orderId) {

        const order = await Order.findById(req.query.orderId, {owner:1});
        console.log(order);
        if (order?.owner?.toString() === req?.session?.user?._id.toString()) {
            return res.status(200).render("order-confirmation", {success: true, order: req.query.orderId});
        }else{
            return res.redirect("404");
        }
        

    } else if (req?.session?.user?._id && req.query.status == "error") {

        res.status(500).render('order-confirmation', {success: false});

    } else {
        res.redirect("404");
    }

}


// ------------------ cancel order ------------------//

export const cancelOrder = async (req,res) => {

    const {itemId, orderId} = req.params;

    function findAllowedAction(orderItemStatus){
            
        const allowedAction = {
            created: "cancel",
            confirmed: "cancel", 
            processing: "cancel", 
            shipped: null, 
            delivered: "return", 
            cancelled: null
        };

        return allowedAction[orderItemStatus];
    }

    try {

        const order = await Order.findOne({_id: orderId, 'orderItems._id': itemId});
        
        if (!order){
            return res.status(400).json({success: false, error: "no such order found" });
        }

        const item = order.orderItems.id(itemId);
        if (!item){
            return res.status(400).json({success: false, error: "no such order item found" });
        }
        
        const product = await Product.findById(item.product);
        if (!product){
            return res.status(400).json({success: false, error: "no such product found" });
        }

        if (findAllowedAction(item.status) != 'cancel') {
            return res.status(400).json({success: false, error: 'cancellation not possible for this order'});
        }

        item.status = 'cancelled';
        product.stock += item.quantity;

        await order.save();
        await product.save();

        return res.status(200).json({success: true, message: `order Cancelled successfully` });

    } catch (error) {
        return res.status(500).json({success: false, error: error.message });
    }
}



export const returnOrder = async (req,res) => {

    const {orderId, itemId} = req.params;
    // const {returnReason} = req.body;

    function findAllowedAction(orderItemStatus){
            
        const allowedAction = {
            created: "cancel",
            confirmed: "cancel", 
            processing: "cancel", 
            shipped: null, 
            delivered: "return", 
            cancelled: null
        };

        return allowedAction[orderItemStatus];
    };


    try {

        const order = await Order.findOne({_id: orderId, 'orderItems._id': itemId});
        if (!order) return res.status(400).json({success: false, error: 'no such order found'});

        const item = order.orderItems.id(itemId);
        if (!item) return res.status(400).json({success: false, error: 'no such order item found'});
        
        const product = Product.findById(item.product);

        if (findAllowedAction(item.status) != 'return') return res.status(400).json({success: false, error: 'This order is not eligible for return'});

        const now = new Date();
        const itemDeliveredAt = item.deliveredAt;
        const maxReturnDate = itemDeliveredAt + (product.returnPeriod * 24 * 60 * 60 * 1000);

        if (now > maxReturnDate) return res.status(400).json({success: false, error: "Return period is over!"});

        item.returnStatus = "requested";

        await order.save();
        return res.status(200).json({success: true, message: "Return request submitted sucessfully"});

    } catch (err) {
        return res.status(500).json({success: true, error: err.message});
    }

}


//get individual order page
export const getOrder = async (req,res) => {

    // const {orderId, itemId} = req.params;

    const orderId = new Types.ObjectId(req.params.orderId);
    const itemId = new Types.ObjectId(req.params.itemId);
    console.log({orderId, itemId})
    
    try{

        const orderByNew = await Order.findOne({_id: orderId, 'orderItems._id': itemId});
        const itemByNew = orderByNew.orderItems.id(itemId);
        const productByNew = await Product.findById(itemByNew.product);
        console.log({orderByNew, itemByNew, productByNew});

        const order = await Order.aggregate([
            
            {$match: {_id: orderId}},
            {$unwind: "$orderItems"},
            {$match: {"orderItems._id" : itemId}},
            {$lookup: {
                from: "products",
                localField: "orderItems.product",
                foreignField: "_id",
                as: "productData"
            }},
            {$unwind: "$productData"}

        ])

        
        function findAllowedAction(orderItemStatus){
            
            const allowedAction = {
                created: "cancel",
                confirmed: "cancel", 
                processing: "cancel", 
                shipped: null, 
                delivered: "return", 
                cancelled: null
            };

            return allowedAction[orderItemStatus];
        };

        const allowedActionForItem = order[0].orderItems.returnStatus == "none" ? findAllowedAction(order[0].orderItems.status) : null;

        console.log({order: order[0].orderItems, allowedAction: allowedActionForItem});

        return res.status(200).render("order", {
            order,
            allowedAction: allowedActionForItem,
            returnStatus: order[0].orderItems.returnStatus,
            payment: order[0].paymentInfo.status
        });

    } catch (error) {
        
        return res.status(500).json({success: false, error : error.message});

    }

}



//------------------- address operations -------------------------//

//add address
export const addAddress = async (req,res) => {

    console.log(req.body);
    
    if(!req.session.user){
        return res.redirect("/");
    }

    try {

        const newAddress = new Address({
            owner : req.session.user._id,
            name : req.body.addressName,
            phone : req.body.addressPhone,
            pincode : req.body.addressPincode,
            address : req.body.addressTextarea,
            city : req.body.addressCity,
            type : req.body.addressType,
            state : req.body.addressState
        });
    
        await newAddress.save();

        console.log(newAddress);
        return res.status(200).json({success:true, message: "New address added successfully", address: newAddress})

    } catch (error) {

        return res.status(500).json({success: false, error: error.message});

    }

}


//delete address
export const deleteAddress = async (req,res) => {
    
    if(req.session.user){

        const {addressId} = req.params;
        try {

            await Address.findByIdAndDelete(addressId);
            return res.redirect("/api/user/profile");
        
        } catch (error) {
            return res.status(500).json({success:false, error: error.message});
        }

    }else{
        return res.redirect("/");
    }

}



//edit address
export const editAddress = async (req,res) => {

    if(req.session.user){

        try {
            
            /////validation pending
            const address = await Address.findById(req.body.editAddressId);
            address.name = req.body.editAddressName;
            address.phone = req.body.editAddressPhone;
            address.pincode = req.body.editAddressPincode;
            address.address = req.body.editAddressTextarea;
            address.city = req.body.editAddressCity;
            address.type = req.body.editAddressType;
            address.state = req.body.editAddressState;
            await address.save();
            return res.status(200).json({success:true, message: "Address updated successfully", address});

        } catch (error) {
            return res.status(500).json({success: false, error: error.message});
        }
    }else{
        return res.redirect("/");
    }
}

//--------------------------------------------//



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



//-------------------- edit profile ------------------------//

//edit profile name
export const editProfileName = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const user = await User.findByIdAndUpdate(req.session.user._id, {fullname: req.body.updatedFullName} , {new:true});
            req.session.user.fullname = req.body.updatedFullName;
            console.log(user);
            return res.status(200).json({success: true, message: "Name updated successfully", firstname: user.fullname.split(" ")[0], lastname: user.fullname.split(" ")[1]});

        
        } catch (error) {
            return res.status(500).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

}


//edit phone
export const editPhone = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const user = await User.findByIdAndUpdate(req.session.user._id, {phone: req.body.updatedPhone} , {new:true});
            req.session.user.phone = req.body.updatedPhone;
            console.log(user);
            res.status(200).json({success: true, message: "Phone Number updated successfully", phone: user.phone});

        
        } catch (error) {
            res.status(500).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

}


//edit email
export const editEmail = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const oldOtp = await sendOtp(req.session.user.email);
            const newOtp = await sendOtp(req.body.updatedEmail);
            const expiry = Date.now()+(60*1000);
            req.session.oldOtp = oldOtp;
            req.session.newOtp = newOtp;
            req.session.otpExpiry = expiry;
            req.session.updatedEmail = req.body.updatedEmail;

            console.log(req.session.oldOtp, req.session.newOtp);
            res.status(200).json({success: true, message: "Otp sent successfully to both emails"});

        
        } catch (error) {
            console.log(error);
            res.status(500).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

}


//confirm email
export const confirmEmail = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){
        
        if (!req.session.updatedEmail){
            return res.status(400).json({success: false, error: "unauthorized"});
        }
    
        if (req.session.otpExpiry < Date.now()){
            return res.status(400).json({success: false, error: "otp expired"});
        }
    
        if(req.session.oldOtp == req.body.oldOtp && req.session.newOtp == req.body.newOtp){
    
            try {
                
                const user = await User.findByIdAndUpdate(req.session.user._id, {email: req.session.updatedEmail}, {new:true});
                req.session.user.email = req.session.updatedEmail;
                console.log(user);
                return res.status(200).json({success: true, message: "Email updated successfully", email:user.email});
    
            
            } catch (error) {
                console.log(error);
                return res.status(500).json({success: false, error: error.message});
            }
    
        }

    }else{
        return res.redirect("/");
    }

}


//--------------------------------------------//



//list products
export const getProducts = async(req,res) => {


    try {

        //category filter
        const categoryArray = [].concat(req.query.category || []);
        let categoryIdArray = [];

        console.log({categoryArray});

        let filter = {
            isUnListed: false,
            stock: {$gt: 0},
        };

        if (Array.isArray(categoryArray) && categoryArray.length) {
            try {
                const categoryIds = await Promise.all(categoryArray.map(category => Category.findOne({name: category}, '_id')));
                categoryIdArray = categoryIds.map(item => item._id);
                filter.category = {$in: categoryIdArray};
            } catch (err) {
                if (err) {
                    return res.status(400).json({success: false, error: err.message});
                }
            }
        }
        

        //for pagination and sort
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const sort = req.query.sort || "default";
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts/limit);

        const sortOptions = {

            popularity : {sales: -1},
            newArrivals : {createdAt: -1},
            priceAsc : {price: 1},
            priceDesc : {price: -1},
            default : {createdAt : 1},
            alphaAsc : {productname: 1},
            alphaDesc : {productname: -1}

        }

        const sortBy = sortOptions[sort] || sortOptions.default;

        let productdata = await Product.find(filter)
                                            .populate("category", "name")
                                            .collation({ locale: 'en', strength: 2 })
                                            .sort(sortBy)
                                            .skip((page-1)*limit)
                                            .limit(limit);
        

        
        //categories and no of products in each category
        const categoryData = await Product.aggregate([

            {
                $group : {
                    _id: '$category',
                    count: {$sum:1}
                }
            },

            {
                $lookup : {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },

            {
                $unwind: '$categoryDetails'
            }

        ]);

        // console.log('category query success ✅')
        
        // ------------- offer fetching and calculations 

        const now = new Date();
        const offers = await Offer.find({
            isActive: true,
            validFrom: {$lte: now},
            expiry: {$gte: now}
        }).lean();

        const offerData = offers.flatMap(offer => {
            
            return offer.appliesTo.map(categ => ({
                offer: offer.name,
                category: categ.categName,
                isPercent: offer.isPercent,
                offerAmount: offer.offerAmount,
                minValue: offer.minimumValue
            }))

        })

        // console.log('offer data query success ✅')

        let wishlist, wishlistSet; 
        if (req.session?.user?._id) {
            wishlist = await Wishlist.findOne({owner: req.session.user._id}).lean();
            wishlistSet = new Set(wishlist?.products?.map(id => id.toString()));
        }

        // console.log('wishlist query done ✅')

        const finalProductData = productdata.map(product => {

            let offerPrice;
            const offer = offerData.find(offer => offer.category.toLowerCase() == product.category.name.toLowerCase());

            const isWishlisted = wishlist ? wishlistSet.has(product._id.toString()) : false;
            
            if (offer && product.price >= offer.minValue){

                if (offer.isPercent) {
                    offerPrice = product.price - (product.price * offer.offerAmount/100);
                } else {
                    offerPrice = product.price - offer.offerAmount;
                }

            } else {
                offerPrice = product.price;
            }

            return {
                ...product.toObject(),
                offerPrice: parseFloat(Math.max(0, offerPrice).toFixed(2)),
                offer: offer?.offer,
                isWishlisted
            }

        })

        // console.log('finalProductData success ✅')

        // console.log({finalProductData});

        // --------- offer fetching and calculations end


        const categData = categoryData.map(category => {
            return {category: category.categoryDetails.name, count: category.count}
        });

        // console.log('final categData success ✅')
        
        return res.status(200).render('user-product-list', {finalProductData, page, totalPages, sort, categData, categoryArray});
        
    } catch (error) {
        return res.status(500).json({success: false, error: error.message});
    }
}


//product page
export const getProductPage  = async(req,res) => {

    const {pId} = req.params;
    const user = req.session.user || null;

    // const [productData, isWishlisted] = await Promise.all([

    //     Product.findById(pId)
    //     .populate('category', 'name')
    //     .populate('subcategory', 'name')
    //     .lean(),

    //     Wishlist.exists({
    //         owner: req.user.session._id,
    //         products: pId
    //     })

    // ])

    
    const productData = await Product.findById(pId).populate("category", "name").populate("subcategory", "name");
    
    let isWishlisted = false;

    if (user) {
        isWishlisted = !!(await Wishlist.exists({
            owner: req.session.user._id,
            products: pId
        }))
    }

    console.log({productData, isWishlisted});

    let relatedProducts = await Product.find(

        {
            category: productData.category,
            _id: {$ne: pId},
            isUnListed: false,
            stock: { $gt: 0 }
        }
    
    ).populate("category", "name");
    
    
    
    // ------------- offer fetching and calculations 

    const now = new Date();
    const offer = await Offer.findOne({
        isActive: true,
        validFrom: {$lte: now},
        expiry: {$gte: now},
        "appliesTo.categName" : productData.category.name
    }).lean();


    let offerPrice, product;
    if (offer) {

        if(offer.isPercent){
            offerPrice = productData.price - (productData.price * offer.offerAmount/100);
        }else{
            offerPrice = productData.price - offer.offerAmount;
        }

        product = {
            ...productData.toObject(),
            offerPrice,
            offer: offer.name 
        };

    }else{
        
        offerPrice = productData.price;

        product = {
            ...productData.toObject(),
            offerPrice
        };
    }

    // --------- offer fetching and calculations end

    return res.status(200).render("user-product-page", {
        product,
        user,
        relatedProducts,
        isWishlisted
    });


}


//set cart count
export const countCart = async (req, res, next) => {
        
    let cartCount = 0;
    if (req.session?.user){
  
      const cart = await Cart.findOne({owner: req.session.user._id});
      cartCount = cart ? cart.items.length : 0;
    
    }
    res.locals.cartCount = cartCount;
    next();
}


export const countWishlist = async (req, res, next) => {

    let wishlistCount = 0;

    if (req.session?.user){

        try{

            const wishlist = await Wishlist.findOne({owner: req.session.user._id});
            wishlistCount = wishlist ? wishlist.products.length : 0;

        }catch(error){

            return res.status(400).json({success: false, error: error.message});

        }
    }

    res.locals.wishlistCount = wishlistCount;
    next();
}


//404 error page
export const errorPage = async (req,res) => {
    
    const user = req.session.user || null;
    res.status(404).render("404", {user});

} 