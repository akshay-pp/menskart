// ------- validation helper functions -----------// 

//set error function
function setError(element, message){
    element.classList.add("is-invalid");
    element.classList.remove("is-valid");
    element.nextElementSibling.textContent = message;
}

//set success function
function setSuccess(element){
    element.classList.add("is-valid");
    element.classList.remove("is-invalid");
    element.nextElementSibling.textContent = "";
}

// //function to check if input empty
// function isEmpty(element){
//     return element.value.trim() == "" ;  
// }

//email validation function
function validateEmail(email){
    
    let emailValue = email.value.trim();
    return (emailValue.match(
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    )) ? true : false;
    
};

//minimum.length
function hasMinimumLength(element,len){
    return element.value.trim().length > len ? true : false;
}

//maximum.length
function hasMaximumLength(element,len){
    return element.value.trim().length < len ? true : false;
}


//empty field validation
function emptyFieldCheck(...args){

    [...args].forEach(input => {

        input.addEventListener("blur", (e) =>{

            if(input.value.trim() == ""){
                setError(input, "Field cant be empty")
            }else{
                setSuccess(input);
            }
    
        })
    })

}




const categoryName = document.getElementById("categoryName");
const categoryDescription = document.getElementById("categoryDescription");
emptyFieldCheck(categoryName,categoryDescription);








const form = document.getElementById("createCategoryForm");
form.addEventListener("submit", async function (e) {

    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData);

    try {
        
        const response = await fetch("/api/admin/category", {
            method: "POST",
            headers: {"Content-Type" : "application/json"},
            body: JSON.stringify({...payload})
        })

        const data = await response.json();

        if (!data.success){

            document.getElementById("add-category-error").textContent = data.error;
            document.getElementById("add-category-error").style.display = "block";

        }else{
            document.getElementById("add-category-error").textContent = data.message;
            document.getElementById("add-category-error").className = "alert alert-success";
            document.getElementById("add-category-error").style.display = "block";
            setTimeout(() => {
                location.reload();
            }, 1500);
        }

    } catch (error) {
        document.getElementById("add-category-error").textContent = error;
        document.getElementById("add-category-error").style.display = "block";
    }


})







//edit category
const editCategoryBtn = document.querySelectorAll("#editCategoryModalBtn");
            
editCategoryBtn.forEach((button) => {

    button.addEventListener("click", function(){
                    
        const categ = this.getAttribute("data-category");

        const category = JSON.parse(categ);
        const editCategoryName = document.getElementById("edit-category-name")
        const editCategoryDescription = document.getElementById("edit-category-description")
        editCategoryName.value = category.name;
        editCategoryDescription.value = category.description;

        emptyFieldCheck(editCategoryName, editCategoryDescription);
        
        document.getElementById("edit-category-form").addEventListener("submit", async (e) => {
                        
            e.preventDefault();

            const formData = new FormData(document.getElementById("edit-category-form"));
            const payload = Object.fromEntries(formData);
            console.log(payload);

            try {
                            
                const response = await fetch(`/api/admin/c/edit/${category._id}`, {
                                
                    method: "PUT",
                    headers: {"Content-Type" : "application/json"},
                    body: JSON.stringify({payload})

                });

                console.log("fetch executed");

                const data = await response.json();

                if (!data.success){

                    document.getElementById("edit-category-error").textContent = data.error;
                    document.getElementById("edit-category-error").style.display = "block";

                }else{
                    document.getElementById("edit-category-error").textContent = data.message;
                    document.getElementById("edit-category-error").className = "alert alert-success";
                    document.getElementById("edit-category-error").style.display = "block";
                    setTimeout(() => {
                        location.reload();
                    }, 1500);
                }
                            

            } catch (error) {

                document.getElementById("edit-category-error").textContent = error;
                document.getElementById("edit-category-error").style.display = "block";

            }
        })
    })
})




            
//unlist category
const unlistCategoryBtn = document.querySelectorAll("#unlistCategoryModalBtn");
unlistCategoryBtn.forEach((button) => {

    button.addEventListener("click", async function(){

        const categ = this.getAttribute("data-category");
        const category = JSON.parse(categ);
        console.log(category);
        console.log(category.isUnListed);

        if (category.isUnListed){

            document.getElementById("unlist-modal-header").textContent = "List Category?";
            document.getElementById("unlist-modal-content").textContent = `Are you sure you want to List the category : ${category.name}?`;
            document.getElementById("confirm-unlist-btn").className = "btn btn-success text-white";
            document.getElementById("confirm-unlist-btn").textContent = "Confirm Listing";

        }else {

            document.getElementById("unlist-modal-header").textContent = "Unlist Category?";
            document.getElementById("unlist-modal-content").textContent = `Are you sure you want to Unlist the category : ${category.name}?`;
            document.getElementById("confirm-unlist-btn").className = "btn btn-danger";
            document.getElementById("confirm-unlist-btn").textContent = "Confirm Unlist";

        }

        document.getElementById("confirm-unlist-form").addEventListener("submit", async (e) => {
            e.preventDefault();

            const payload = category.isUnListed ? "To List" : "To Unlist" ; 
                        
            const response = await fetch(`/api/admin/c/unlist/${category._id}`, {
                method : "POST",
                headers : { "Content-Type" : "application/json" },
                body : JSON.stringify({payload})
            });

            const data = await response.json();

            if (!data.success){
                            
                document.getElementById("unlist-category-error").textContent = data.error;
                document.getElementById("unlist-category-error").className = "alert alert-danger";
                document.getElementById("unlist-category-error").style.display = "block";
                        
            }else{

                document.getElementById("unlist-category-error").textContent = data.message;
                document.getElementById("unlist-category-error").className = "alert alert-success";
                document.getElementById("unlist-category-error").style.display = "block";
                setTimeout(() => {
                    location.reload();
                }, 1000);

            }
        })

    })
})

