export const applyOfferPricesToCart = (cart, productsWithOfferPrice) => {
   
    // if cart item has no offer, return with just subtotal.
    // else, attach an offerInfo object and subtotal to the cartItem.
    // offerInfo = { offerId: ObjectId, discount: Number }


    const cartLean = cart.toObject();
    const priceMap = new Map();

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
            return;
        };

        if (priceData.offerPrice < item.price) {
            item.offerPrice = priceData.offerPrice;
            item.offerInfo = priceData.offerInfo;
            item.subtotal = priceData.offerPrice*item.quantity;
            // console.log({currentPrice, offerInfo});
        };
    });

    cartLean.totalPrice = cartLean.items.reduce((total, item) => {
        return  total + item.subtotal;
    },0);

    return cartLean;
};



export const pricingBreakdown = function (cart) {

    let itemsTotal, offerDiscount, couponDiscount, discount, shipping = 40, tax = 0, grandTotal;

    itemsTotal = cart.items.reduce((total, item) => {
        total + (item.price * item.quantity)
    },0);

    offerDiscount = cart.items.reduce((total, item) => {
        return total + (item.offerInfo?.discount * item.quantity || 0);
    } ,0);

    couponDiscount = cart.couponInfo?.discount || 0;
    discount = (offerDiscount + couponDiscount) || 0;

    grandTotal = itemsTotal - discount + shipping + tax;

    return {itemsTotal, discount, shipping, grandTotal};

};



