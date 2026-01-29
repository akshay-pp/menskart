import {emptyFieldCheck, typeValidation} from "./validationHelpers.js"


//----------------------------- edit profile  -----------------------------//

//------------ name fields ------------//
const editNameBtn = document.getElementById("name-edit-btn");
const editFirstName = document.getElementById("edit-firstname");
const editLastName = document.getElementById("edit-lastname");
const updateNameBtn = document.getElementById("name-update-btn");
const updateNameError = document.getElementById("update-name-error");




editNameBtn.addEventListener("click", async function(e) {

    if (this.textContent == "Edit"){

        this.innerText = "Save";
        this.className = "btn btn-primary";
        editFirstName.removeAttribute("disabled");
        editLastName.removeAttribute("disabled");
        editFirstName.focus();

    }else if (this.textContent == "Save"){

        const updatedFirstName = editFirstName.value.trim();
        const updatedLastName = editLastName.value.trim();
        const updatedFullName = `${updatedFirstName} ${updatedLastName}`;

        const response = await fetch("/api/user/profile/edit/name", {

            method: "PATCH",
            headers: {"Content-Type" : "application/json"},
            body : JSON.stringify({updatedFullName})

        })

        const data = await response.json();

        if (!data.success){

            updateNameError.className = "alert alert-danger";
            updateNameError.textContent = data.error;
            updateNameError.style.display = "block";

        }else{

            editFirstName.value = data.firstname;
            editLastName.value = data.lastname;
            editFirstName.setAttribute("disabled", "true");
            editLastName.setAttribute("disabled", "true");
            this.innerText = "Edit";
            this.className = "btn btn-outline-dark";
            updateNameError.className = "alert alert-primary";
            updateNameError.textContent = data.message;
            updateNameError.style.display = "block";
            setTimeout(() => {
                updateNameError.style.display = "none";
            }, 3000);

        }

    }
})




//------------ email field ------------//
const editEmailBtn = document.getElementById("email-edit-btn");
const editEmail = document.getElementById("edit-email");
const updateEmailBtn = document.getElementById("email-update-btn");
const updateEmailError = document.getElementById("update-email-error");


editEmailBtn.addEventListener("click", async function(e) {

    const error = document.getElementById("email-update-error");
    const emailForm = document.getElementById("update-email-form");
    const otpForm = document.getElementById("email-verif-otp");

    document.getElementById("send-otp-btn").addEventListener("click", async(e) => {


        e.preventDefault();

        const updatedEmail = document.getElementById("updated-email").value.trim();


        const response = await fetch("/api/user/profile/edit/email", {

            method: "POST",
            headers: {"Content-Type" : "application/json"},
            body : JSON.stringify({updatedEmail})

        })

        const data = await response.json();

        if (!data.success){

            error.className = "alert alert-danger";
            error.textContent = data.error;
            error.style.display = "block";

        }else{

            emailForm.style.display = "none";
            otpForm.style.display = "block";

        }

    })
})



document.getElementById("verify-otp-btn").addEventListener("click", async(e) => {
    
    const otpError = document.getElementById("updateEmail-otp-error");
    
    e.preventDefault();

    const oldOtp = document.getElementById("otp-old-email").value.trim();
    const newOtp = document.getElementById("otp-new-email").value.trim();

    const response = await fetch("/api/user/profile/edit/email", {

        method: "PATCH",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({oldOtp, newOtp})

    })

    const data = await response.json();

    if (!data.success){

        otpError.className = "alert alert-danger";
        otpError.textContent = data.error;
        otpError.style.display = "block";

    }else{

        otpError.className = "alert alert-primary";
        editEmail.value = data.email;
        otpError.textContent = data.message;
        otpError.style.display = "block";
        setTimeout(() => {
            otpError.style.display = "none";
        }, 3000);


    }
    


})


//------------ phone field ------------//
const editPhoneBtn = document.getElementById("phone-edit-btn");
const editPhone = document.getElementById("edit-phone");
const updatePhoneBtn = document.getElementById("phone-update-btn");
const updatePhoneError = document.getElementById("update-phone-error");

editPhoneBtn.addEventListener("click", async function(e) {

    if (this.textContent == "Edit"){

        this.innerText = "Save";
        this.className = "btn btn-primary";
        editPhone.removeAttribute("disabled");
        editPhone.focus();

    }else if (this.textContent == "Save"){

        const updatedPhone = editPhone.value.trim();

        const response = await fetch("/api/user/profile/edit/phone", {

            method: "PATCH",
            headers: {"Content-Type" : "application/json"},
            body : JSON.stringify({updatedPhone})

        })

        const data = await response.json();

        if (!data.success){

            updatePhoneError.className = "alert alert-danger";
            updatePhoneError.textContent = data.error;
            updatePhoneError.style.display = "block";

        }else{

            editPhone.value = data.phone;
            editPhone.setAttribute("disabled", "true");
            this.innerText = "Edit";
            this.className = "btn btn-outline-dark";
            updatePhoneError.className = "alert alert-primary";
            updatePhoneError.textContent = data.message;
            updatePhoneError.style.display = "block";
            setTimeout(() => {
                updatePhoneError.style.display = "none";
            }, 3000);

        }

    }
})


//----------------------------- edit profile end  -----------------------------//




//----------------------------- add new address  -----------------------------//

const form = document.getElementById("add-address-form");
const addressError = document.getElementById("add-address-error");


const fields = document.querySelectorAll(`#add-address-form input, #add-address-form textarea`);

emptyFieldCheck("blur", ...fields);
typeValidation("blur", ...fields);


form.addEventListener("submit", async (e) => {

    e.preventDefault();
    emptyFieldCheck("submit", ...fields);

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData);

    const response = await fetch("/api/user/profile/add-address", {

        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({...payload})

    })

    const data = await response.json();

    if (!data.success){

        addressError.className = "alert alert-danger";
        addressError.textContent = data.error;
        addressError.style.display = "block";
    
    }else {

        addressError.className = "alert alert-primary";
        addressError.textContent = data.message;
        addressError.style.display = "block";
        setTimeout(() => {
            addressError.style.display = "none";
            location.reload();
        }, 3000);


    }

})

// $('#add-address-modal').on('hidden.bs.modal', function () {
//     $(this).find('input').val('');
// });


//----------------------------- delete address  -----------------------------//

document.querySelectorAll("#delete-address-btn").forEach(button => {

    button.addEventListener("click", async function (e) {

        const addressId = this.getAttribute("data-id");
        const confirmDelete = document.getElementById("confirm-delete-form");
        confirmDelete.action = `/api/user/profile/delete-address/${addressId}`;

    })

})



//----------------------------- edit address  -----------------------------//

document.querySelectorAll("#edit-address-btn").forEach(button => {

    button.addEventListener("click", async function(){

        const dataAddress = this.getAttribute("data-address");
        const address = JSON.parse(dataAddress);

        document.getElementById("address-id").value = address._id;
        document.getElementById("edit-address-name").value = address.name;
        document.getElementById("edit-address-phone").value = address.phone;
        document.getElementById("edit-address-textarea").value = address.address;
        document.getElementById("edit-address-pincode").value = address.pincode;
        document.getElementById("edit-address-city").value = address.city;
        document.getElementById("edit-address-state").value = address.state;
        document.getElementById("edit-address-type").value = address.type;

    })

});


const editForm = document.getElementById("edit-address-form");
const editAddressError = document.getElementById("edit-address-error");

editForm.addEventListener("submit", async function(e){
    e.preventDefault();

    const formData = new FormData(editForm);
    const payload = Object.fromEntries(formData);
    console.log(payload);

    const response = await fetch("/api/user/profile/edit-address", {
        method: "PUT",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({...payload})
    });

    const data = await response.json();

    if(!data.success){
        editAddressError.className = "alert alert-danger";
        editAddressError.textContent = data.error;
        editAddressError.style.display = "block";
    }else{
        editAddressError.className = "alert alert-primary";
        editAddressError.textContent = data.message;
        editAddressError.style.display = "block";
        setTimeout(() => {
            editAddressError.style.display = "none";
            location.reload();
        }, 3000);
    }

})
