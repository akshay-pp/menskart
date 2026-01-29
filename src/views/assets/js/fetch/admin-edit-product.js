const deleteImageBtn = document.querySelectorAll("#delete-image-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const editProductError = document.getElementById("edit-product-error");

let productId = null;
let image = null;


deleteImageBtn.forEach(button => {
    button.addEventListener("click", async () => {
        productId = button.getAttribute("data-id");
        image = button.getAttribute("data-src");
        console.log(productId, image);
    })
})

confirmDeleteBtn.addEventListener("click", async (e) => {
    
    e.preventDefault();
    console.log(productId, image);
    try {

        const response = await fetch("/api/admin/image/delete", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, image })
        });
        const data = await response.json();

        if(!data.success){
            document.getElementById("edit-product-error").className = "alert alert-danger";
            document.getElementById("edit-product-error").textContent = data.error;
            document.getElementById("edit-product-error").style.display = "block";
        }else{
            document.getElementById("edit-product-error").className = "alert alert-success";
            document.getElementById("edit-product-error").textContent = data.message;
            document.getElementById("edit-product-error").style.display = "block";
            setTimeout(() => {
                location.reload();
            }, 1500);
        }
    
    } catch (error) {
        document.getElementById("edit-product-error").className = "alert alert-danger";
        document.getElementById("edit-product-error").textContent = error.message;
        document.getElementById("edit-product-error").style.display = "block";
    }

})
