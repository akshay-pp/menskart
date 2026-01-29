import { triggerToast } from "./validationHelpers.js";

let cartItemId;
document.querySelectorAll(".remove-from-cart").forEach(button => {

    button.addEventListener("click", function () {

        cartItemId = this.getAttribute("data-id");
        console.log(cartItemId);
        
    })

})


document.getElementById("confirm-remove-from-cart").addEventListener("submit", async function(e) {

    e.preventDefault();

    const response = await fetch("/api/user/cart", {

        method: "DELETE",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({cartItemId})

    })

    $('#remove-from-cart-modal').modal('hide');
    
    const data = await response.json();


    if (data.success) {

        document.getElementById(`${cartItemId}-cart`)?.remove();
        $('#cart-sub-total, #total-order-value').text(`₹${data.total}`);
        triggerToast('success', 'Removed from cart');
        const cartCount = document.getElementById("cart-count")
        cartCount.textContent = parseInt(document.getElementById("cart-count").textContent) - 1;

        if (cartCount.textContent == 0) {

            document.getElementById('empty-cart-div').classList.remove('d-none')
            document.getElementById('empty-cart-div').classList.add('d-flex');
            
            document.getElementById('cart-content').classList.add('d-none');

            
        }

    } else {

        triggerToast('failure', data.error || data.message);

    }

    // setTimeout(() => {
    //     location.reload();
    // }, 500);

})






// function showAlert(data, element) {
    
//     if(!data.success){

//         element.className = `alert alert-danger`;
//         element.textContent = data.error;
//         element.style.display = "block";

//     }else{

//         element.className = `alert alert-primary`;
//         element.textContent = data.message;
//         element.style.display = "block";

//     }
    
// }