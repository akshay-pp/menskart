//set error function
export function setError(element, message){
    element.classList.add("is-invalid");
    element.classList.remove("is-valid");
    if (element.nextElementSibling) {
        element.nextElementSibling.textContent = message;
    }
}


//set success function
export function setSuccess(element){
    element.classList.add("is-valid");
    element.classList.remove("is-invalid");
    if (element.nextElementSibling) {
        element.nextElementSibling.textContent = "";
    }
}


export function clearFeedback(element){
    element.classList.remove("is-invalid");
    if (element.nextElementSibling) {
        element.nextElementSibling.textContent = "";
    }
}


//email validation
export function validateEmail(email){
    
    let emailValue = email.value.trim();
    return (emailValue.match(
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    )) ? true : false;
    
};


//minimum.length
export function hasMinimumLength(element,len){
    return element.value.trim().length >= len ? true : false;
}


//maximum.length
export function hasMaximumLength(element,len){
    return element.value.trim().length <= len ? true : false;
}


//function to check if input empty
export function isEmpty(element){
    return element.value.trim() == "" ;  
}


//empty check on blur event
export function emptyFieldCheck(event, ...args){

    if (event == "blur") {

        args.forEach(input => {
            input.addEventListener("blur", () =>{
                if (isEmpty(input)) {
                    setError(input, "Field can't be empty");
                } else {
                    clearFeedback(input);
                }
            })
        })

    } else if (event == "submit") {

        let isValid = true;
        args.forEach(input => {
            if (isEmpty(input)) {
                setError(input, "Field can't be empty");
                isValid = false;
            } else {
                clearFeedback(input);
            }
        })
        return isValid;
        
    }

}


export function typeValidation(event, ...args){

    const regexMap = {
        
        name: /^[a-zA-Z\s,'-]+$/,
        address: /^[a-zA-Z0-9\s,'#./&()-]+$/,
        textarea: /^[\s\S]{1,500}$/,
        phone: /^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[6789]\d{9}$/,
        pincode: /^[1-9][0-9]{5}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    };

    const messageMap = {

        name: "Enter a valid name",
        address: "Enter a valid address",
        textarea: "Invalid characters in text",
        phone: "Enter a valid Indian phone number",
        pincode: "Enter a valid 6-digit pincode",
        email: "Enter a valid email"

    };


    function validateInput(input){

        const validationType = input.dataset.valid;
        const regex = regexMap[validationType];
        const value = input.value.trim();

        if(!regex) return {valid: false, message: "Unknown validation type"};

        return regex.test(value) ? {valid: true} : {valid: false, message: messageMap[validationType] || "Invalid Input"};

    }

    if (event == "blur") {
        args.forEach(input => {
            input.addEventListener("blur", () => {
                const {valid, message} = validateInput(input);
                valid ? setSuccess(input) : setError(input, message);
            })
        })
    } else if (event == "submit") {
        let allValid = true;
        args.forEach(input => {
            const {valid, message} = validateInput(input);
            if (!valid) {
                setError(input, message);
                allValid = false;
            } else {
                setSuccess(input);
            }
        })
        return allValid;
    }

}



export function showAlert(data, alertElement) {
    
    if(!data.success){

        alertElement.className = `alert alert-danger`;
        alertElement.textContent = data.error||data.message;
        alertElement.style.display = "block";

    }else{

        alertElement.className = `alert alert-primary`;
        alertElement.textContent = data.message;
        alertElement.style.display = "block";

    }
    
}


export function triggerToast (status, feedbackMessage) {

    // status - type: string - enum ['success', 'warning', 'failure']
    // feedbackMessage - type: string - any error message

    const toastId = document.querySelector('.toast')?.id

    document.querySelector(`#${toastId} #toast-title`).textContent = feedbackMessage;
    document.querySelectorAll(`#${toastId} .toast-icon`).forEach(el => el.classList.add('d-none'))
    document.getElementById(`${status}-toast`)?.classList.remove("d-none"); 

    // trigger toast
    $(`#${toastId}`).toast({delay: 3000});
    $(`#${toastId}`).toast('show');

}