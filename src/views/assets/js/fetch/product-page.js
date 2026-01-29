import { triggerToast } from "./validationHelpers.js";


//add to cart
const addToCart = async function(e) {

    e.preventDefault();

    const formData = new FormData(this);
    const payload = Object.fromEntries(formData);
    console.log(payload);
    
    const response = await fetch("/api/user/cart", {

        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({...payload})
        
    })

    const data = await response.json();

    if (!data.success) {


        //item already exist in cart toast
        if (response.status == 200) {
            triggerToast('warning', data.error || data.message);
            return;
        }

        // console.log(data.error)
        
        //trigger failure toast
        triggerToast('failure', data.error || data.message);


        if (data.redirect){

            // $("#signin-modal").modal("show");
            window.location.href = data.redirect;
            // setTimeout(() => {
                
            // }, 1000);
        }

    } else {

        if (payload.referer == "wishlist") {

            this.closest('tr').remove();
            document.getElementById("wishlist-count").textContent = parseInt(document.getElementById("wishlist-count").textContent) - 1;

        }

        document.getElementById("cart-count").textContent = parseInt(document.getElementById("cart-count").textContent) + 1;

        triggerToast('success', 'Product added to cart') 

    }

    console.log(data);
}


let addToCartForm = document.getElementById("add-to-cart-form");
if (addToCartForm) {
    addToCartForm.addEventListener("submit", addToCart);
} else {
    addToCartForm = document.querySelectorAll(".add-to-cart-form");
    addToCartForm.forEach(form => {
        form.addEventListener("submit", addToCart);
    })
}






//add to wishlist 
const addToWishlist = async function(e) {

    e.preventDefault();

    const productId = (new FormData(this)).get('productId');
    const addToWishlistBtn = this.querySelector('button[type="submit"]');
    const isWishlisted = addToWishlistBtn.dataset.iswishlisted === "true"
    const method = isWishlisted ? "DELETE" : "POST";

    console.log({productId, addToWishlistBtn, isWishlisted, method});
    
    const response = await fetch(`/api/user/wishlist/${productId}`, {

        method,
        headers: {"Content-Type" : "application/json"},

    })

    const data = await response.json();

    if (!data.success) {

        console.log(data.error)
        triggerToast('failure', data.error || data.message)
        
        if (data.redirect){

            // $("#signin-modal").modal("show");
            window.location.href = data.redirect;
            // setTimeout(() => {
                
            // }, 1000);
        }

    } else {

        if (data.isAdded) {

            console.log(data.message);

            addToWishlistBtn.dataset.iswishlisted = "true";
            addToWishlistBtn.querySelector('span') && (addToWishlistBtn.querySelector('span').textContent = 'Wishlisted');
            addToWishlistBtn.querySelector('i').className = 'icon-heart';

            triggerToast('success', 'Added to Wishlist')
            
            //increase wishlist count
            document.getElementById("wishlist-count").textContent = parseInt(document.getElementById("wishlist-count").textContent) + 1;

        } else if (data.isRemoved) {

            console.log(data.message);

            addToWishlistBtn.dataset.iswishlisted = "false";
            addToWishlistBtn.querySelector('span') && (addToWishlistBtn.querySelector('span').textContent = 'Add to wishlist');
            addToWishlistBtn.querySelector('i').className = 'icon-heart-o';

            triggerToast('failure', 'Removed from Wishlist');

            document.getElementById("wishlist-count").textContent = parseInt(document.getElementById("wishlist-count").textContent) - 1;

        }

    }


    console.log(data);


}


let addToWishlistForm = document.getElementById("add-to-wishlist-form");
if (addToWishlistForm){
    addToWishlistForm.addEventListener("submit", addToWishlist);
}else{
    addToWishlistForm = document.querySelectorAll(".add-to-wishlist-form");
    addToWishlistForm.forEach(form => {
        form.addEventListener("submit", addToWishlist);
    })
}




