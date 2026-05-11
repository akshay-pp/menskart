import { Cart } from "../models/cart.model.js";
import { Wishlist } from "../models/wishlist.model.js";
import { Product } from "../models/product.model.js";
import { applyOfferPricesToCart } from "../utils/pricing.js";
import { STATUS_CODES } from "../utils/constants/statusCodes.js";


//------------------- cart operations -------------------//


export const countCart = async (req, res, next) => {
        
    let cartCount = 0;
    if (req.session?.user){
  
      const cart = await Cart.findOne({owner: req.session.user._id});
      cartCount = cart ? cart.items.length : 0;
    
    }
    res.locals.cartCount = cartCount;
    next();
};


//get cart page
export const getCart = async (req,res) => {

    const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product', 'productname price images stock maxQuantity');

    const cartWithOffersApplied = await applyOfferPricesToCart(cart);

    console.log(cartWithOffersApplied);

    return res.render("cart", {cart: cartWithOffersApplied});

};


//add to cart
export const addToCart = async (req,res) => {

    const productId = req.body.productId;
    const quantity = req.body.quantity || 1;

    try {

        const product = await Product.findById(productId);

        // validations

        if(!product){
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: "error fetching product"});
        }

        if(quantity > product.maxQuantity){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `Maximum quantity for ${product.productname} is ${product.maxQuantity}`});
        }

        if(quantity > product.stock){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `Sorry! Not enough stock`});
        }

        if(product.stock <= 0){
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: "Product out of stock"});
        }

        // validations - end


        let cart;
        try {
            cart = await Cart.findOne({owner: req.session.user._id});
        } catch (error) {

            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});

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
            return res.status(STATUS_CODES.SUCCESS).json({success: false, error: "Item already in cart"});
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
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
            }
        }

        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: `${product.productname} has been added to the cart`, cart});
        
        
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }

};


//remove from cart
export const removeFromCart = async(req,res) => {

    const {cartItemId} = req.body;
    try {
        
        const cart = await Cart.findOne({owner: req.session.user._id});
        console.log(cart);

        if(!cart){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Cart not found"});
        }

        if (cart.items.find(item => item._id.toString() == cartItemId)){
            try {
                cart.items = cart.items.filter(item => item._id.toString() != cartItemId);
                await cart.save();
                const cartWithOffersApplied = await applyOfferPricesToCart(cart);

                return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Product successfully removed from cart", total: cartWithOffersApplied.totalPrice});
            } catch (error) {
                console.log({cartItemId, itemId: item._id})
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
            }
        } else {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Cart item not found"});
        }
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error : error.message});
    }

};

//update quantity
export const updateQuantity = async(req,res) => {

    const {itemId} = req.params;
    const {quantity} = req.body;

    try {
    
        const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product');
        let item = cart.items.find(item => item._id == itemId);
        console.log(item);

        if (item.product.stock < quantity) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Not enough stock" });
        };

        if (quantity > item.product.maxQuantity) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `limited to ${item.product.maxQuantity} per user`});
        };
         
        item.quantity = quantity;
        let lastUpdatedQuantity = Math.min(quantity, item.product.stock)
        await cart.save();
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Quantity updated", lastUpdatedQuantity})

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }

}

//--------------------------------------------//