import { Product } from "../models/product.model";
import { Wishlist } from "../models/wishlist.model";
import { STATUS_CODES } from "../utils/constants/statusCodes";



//------------------- wishlist operations -------------------------//


export const countWishlist = async (req, res, next) => {

    let wishlistCount = 0;

    if (req.session?.user){

        try {
            const wishlist = await Wishlist.findOne({owner: req.session.user._id});
            wishlistCount = wishlist ? wishlist.products.length : 0;
        } catch(error){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: error.message});
        };
    }

    res.locals.wishlistCount = wishlistCount;
    next();
};


//get wishlist
export const getWishlist = async(req,res) => {

    try {
        
        const wishlist = await Wishlist.findOne({owner: req.session.user._id}).populate('products');

        if (!wishlist || wishlist.products.length == 0){
            return res.render("wishlist", {wishlist, isEmpty: true});
        }

        return res.render("wishlist", {wishlist, isEmpty: false});

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
};



//add to wishlist
export const addToWishlist = async(req,res) => {

    const {productId} = req.params;

    console.log({path: req.path});

    try {
        
        const product = await Product.findById(productId);
        console.log('product query success ✅');

        if (!product){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Product doesn't exist"});
        }

        let wishlist = await Wishlist.findOne({owner: req.session.user._id});
        console.log('wishlist query success ✅');

        if (!wishlist){
            wishlist = new Wishlist({
                owner: req.session.user._id
            });
        }

        if (wishlist.products.find(item => item.toString() == productId)){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Product already exists in wishlist"});
        }

        wishlist.products.push(productId);
        await wishlist.save();

        return res.status(STATUS_CODES.SUCCESS).json({success: true, isAdded: true, message: "Product added to wishlist"});
        

    } catch (error) {

        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    
    }

};


//remove from wishlist
export const removeFromWishlist = async (req,res) => {

    const {productId} = req.params;

    try {

        const wishlist = await Wishlist.findOne({owner: req.session.user._id});
        
        //validations
        wishlist.products = wishlist.products.filter(item => item.toString() != productId);
        await wishlist.save();
        
        return res.status(STATUS_CODES.SUCCESS).json({success: true, isRemoved: true, message: "Product removed from wishlist"});

    }catch (error){
        
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
};

