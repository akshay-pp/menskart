import {Product} from '../models/product.model.js';
import {findBestPrice} from './calculateOfferPrice.js';


export const getProductsWithOfferPrice = async (cart) => {
    // find the current best price of each product in the cart-
    // -by applying the best available offer
    const productIds = cart.items.map(item => item.product._id);
    const products = await Product.find({_id: {$in: productIds}}).lean();
    const productsWithOfferPrice = await findBestPrice(...products);
    return productsWithOfferPrice;
}



export const applyOfferPricesToCart = async (cart) => {
   
    // if cart item has no offer, return with just subtotal.
    // else, attach an offerInfo object, subtotal and finalPrice to the cartItem and a pricing breakdown.
    // offerInfo = { offerId: ObjectId, discount: Number }

    const cartLean = cart.toObject();
    const priceMap = new Map();
    const productsWithOfferPrice = await getProductsWithOfferPrice(cart);


    productsWithOfferPrice.forEach(product => {
        if (!product.offer){ 
            return;
        }
        priceMap.set(product._id.toString(), {offerPrice: product.offerPrice, offerInfo: {offerId: product.offer._id, discount: product.appliedDiscount}});
    });



    // if (!priceMap.size) return cartLean;
    // console.log(priceMap);



    cartLean.items.forEach(item => {
        // console.log({price: priceMap.get(item.product._id.toString())});
        const priceData = priceMap.get(item.product._id.toString());
        
        if (!priceData) {
            item.subtotal = item.price*item.quantity;
            item.finalPrice = item.subtotal;
            return;
        };

        if (priceData.offerPrice < item.price) {
            item.offerPrice = priceData.offerPrice;
            item.offerInfo = priceData.offerInfo;
            item.subtotal = priceData.offerPrice*item.quantity;
            item.finalPrice = item.subtotal;
            // console.log({currentPrice, offerInfo});
        };
    });

    cartLean.totalPrice = cartLean.items.reduce((total, item) => {
        return  total + item.finalPrice;
    },0);


    cartLean.pricing = pricingBreakdown(cartLean);
    return cartLean;
};



export const pricingBreakdown = function (cart) {

    let itemsTotal, offerDiscount, couponDiscount, totalDiscount, shipping = 40, tax = 0, grandTotal;

    itemsTotal = cart.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    },0);

    offerDiscount = cart.items.reduce((total, item) => {
        return total + (item.offerInfo?.discount * item.quantity) || 0;
    } ,0);

    couponDiscount = cart.couponInfo?.discount || 0;
    totalDiscount = (offerDiscount + couponDiscount) || 0;
    shipping = (itemsTotal - totalDiscount) > 999 ? 0 : 40;
    grandTotal = (itemsTotal - totalDiscount) + shipping + tax;

    return {
        itemsTotal,
        discount: {
            offerDiscount,
            couponDiscount,
            totalDiscount
        },
        shipping,
        grandTotal
    };

};



