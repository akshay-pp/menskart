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

//function to check if input empty
function isEmpty(element){
    return element.value.trim() == "" ;  
}

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


// ------- || -----------// 






// ------- login -----------// 

function login(){

    const loginBtn = document.getElementById("login-btn");
    const loginError = document.getElementById("login-error");
    
    const email = document.getElementById("login-email");
    const password = document.getElementById("login-password");
    
    (function blurValidation(){
    
        [email, password].forEach(input => {
    
            input.addEventListener("blur", () => {
                if(input.id == "login-email"){
                    if (isEmpty(input)){
                        setError(input, "Please provide an email address");
                    }else{
                        validateEmail(input) ? setSuccess(input) : setError(input, "Please provide a valid email address");
                    }
    
                }else if (input.id == "login-password"){
                    if (isEmpty(input)){
                        setError(input, "Password can't be empty");
                    }else{
                        hasMinimumLength(input,8) ? setSuccess(input) : setError(input, "Password should be atleast 8 characters long");
                    }
                }
            })
        })
    })();


    //final form submit validation
    function formSubmitValidation(){
    
        let isValid = true;
        if (isEmpty(email)){
            setError(email, "Please provide an email address");
            isValid = false;
        }else{
            if (validateEmail(email)){
                setSuccess(email);
            }else{
                setError(email, "Please provide a valid email address");
                isValid = false;
            }
        }

        if (isEmpty(password)){
            setError(password, "Password can't be empty");
            isValid = false;
        }else{
            if (hasMinimumLength(password,8)) {
                setSuccess(password);
            }else {
                setError(password, "Password should be atleast 8 characters long");
                isValid = false;
            }
        }

        return isValid;
    }
    
    
    loginBtn.addEventListener("click", async(event) => {
    
        event.preventDefault();

        if(!formSubmitValidation()){
            return false;
        }
    
        try {
    
            const response = await fetch("/api/user/login", {
                method : 'POST',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({email: email.value.trim(), password: password.value})
            });
        
            const data = await response.json();
        
            if (!data.success){
    
                loginError.textContent = data.error;
                loginError.style.display = "block";
            
            }else{
                
                loginError.className = "alert alert-primary";
                loginError.textContent = data.message;
                loginError.style.display = "block";
                
                setTimeout(() => {
                    location.reload();
                }, 1500);
            
            }
    
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = "block";
        }
    
    });

}

login();






// ------- register form validations -----------// 

function register(){

    const loginForm = document.getElementById("login-form");
    const registerBtn = document.getElementById("signup-btn");
    const registerForm = document.getElementById("register");
    const registerOtpForm = document.getElementById("register-otp-form");
    const registerError = document.getElementById("register-error");
    const resendOtpBtn = document.getElementById("resend-otp");
    const resendOtpTimer = document.getElementById("resend-otp-timer");


    //input fields
    const fullname = document.getElementById("register-name");
    const registerEmail = document.getElementById("register-email");
    const registerPassword = document.getElementById("register-password");


    //input blur validation 
    (function blurValidation(){

        [fullname, registerEmail, registerPassword].forEach(input => {

            input.addEventListener("blur", () => {
                if(input.id == "register-name"){
                    isEmpty(input) ?  setError(input, "Please provide a fullname") : setSuccess(input);

                }else if(input.id == "register-email"){
                    if (isEmpty(input)){
                        setError(input, "Please provide an email address");
                    }else{
                        validateEmail(input) ? setSuccess(input) : setError(input, "Please provide a valid email address");
                    }

                }else if (input.id == "register-password"){
                    if (isEmpty(input)){
                        setError(input, "Password can't be empty");
                    }else{
                        hasMinimumLength(input,8) ? setSuccess(input) : setError(input, "Password should be atleast 8 characters long");
                    }
                }
            })
        })
    })();


    //final form submit validation
    function formSubmitValidation(){
        
        let isValid = true;
        if (isEmpty(fullname)) {
            setError(fullname, "Please provide a fullname");
            isValid = false;
        } else {
            setSuccess(fullname);
        }

        if (isEmpty(registerEmail)){
            setError(registerEmail, "Please provide an email address");
            isValid = false;
        }else{
            if (validateEmail(registerEmail)){
                setSuccess(registerEmail);
            }else{
                setError(registerEmail, "Please provide a valid email address");
                isValid = false;
            }
        }

        if (isEmpty(registerPassword)){
            setError(registerPassword, "Password can't be empty");
            isValid = false;
        }else{
            if (hasMinimumLength(registerPassword,8)) {
                setSuccess(registerPassword)
            }else {
                setError(registerPassword, "Password should be atleast 8 characters long");
                isValid = false;
            }
        }

        return isValid;
    }


    registerBtn.addEventListener("click", async (e) => {

        e.preventDefault();
        
        if (formSubmitValidation()) {
            
            const response = await fetch("/api/user/register", {
        
                method: "POST",
                headers: {"Content-Type" : "application/json"},
                body: JSON.stringify({fullname: fullname.value, email: registerEmail.value, password: registerPassword.value})
        
            });
        
            const data = await response.json();
            
            if (!data.success){
        
                registerError.textContent = data.error;
                registerError.style.display = "block";
        
            }else{
                
                loginForm.style.display = "none";
                registerForm.style.display = "none";
                registerOtpForm.style.display = "block";
                
                let timeLeft = 30;
                let timerId = setInterval(countdown, 1000);
    
                function countdown() {
                    if (timeLeft == -1) {
                        clearInterval(timerId);
                        resendOtpTimer.textContent = "";
                        resendOtpBtn.removeAttribute("disabled");
                        
                    } else {
                        resendOtpTimer.textContent = timeLeft > 9 ? `00:${timeLeft}` : `00:0${timeLeft}`;
                        timeLeft--;
                    }
                } 
            }
        }else{
            return false;
        }
    }) 
}

register();




// ------- resend-registration-otp -----------// 
const resendOtpBtn = document.getElementById("resend-otp");
const resendOtpTimer = document.getElementById("resend-otp-timer");

resendOtpBtn.addEventListener("click", async(event) => {
    
    event.preventDefault();
    
    const response = await fetch("/api/user/resend-otp", {
        method: "POST",
        headers: {'Content-Type' : 'application/json'}
    });

    const data = await response.json();

    if(!data.success){

        registerOtpError.className = "alert alert-danger";
        registerOtpError.textContent = data.error;
        registerOtpError.style.display = "block";
        
    }else{
        
        resendOtpBtn.textContent = "Wait...";
        resendOtpBtn.disabled = true;
        let resendTimeLeft = 30;
        let resendTimerId = setInterval(resendCountdown, 1000);
            
        function resendCountdown() {
            if (resendTimeLeft == -1) {
                clearInterval(resendTimerId);
                resendOtpTimer.textContent = "";
                resendOtpBtn.removeAttribute("disabled");
                resendOtpBtn.textContent = "Resend OTP";      
            } else {
                resendOtpTimer.textContent = resendTimeLeft > 9 ? `00:${resendTimeLeft}` : `00:0${resendTimeLeft}`;
                resendTimeLeft--;
            }
        }
        registerOtpError.className = "alert alert-success";
        registerOtpError.textContent = data.message;
        registerOtpError.style.display = "block";
        setTimeout(() => {
            registerOtpError.style.display = "none";
        },2000);

    }
})




// ------- verify-registration-otp -----------// 

const verifyOtpBtn = document.getElementById("verify-otp-btn");
const registerOtpError = document.getElementById("register-otp-error");

verifyOtpBtn.addEventListener("click", async(event) => {

    event.preventDefault();
    const otp = document.getElementById("otp-received").value;

    const response = await fetch("/api/user/verify-registration", {
        
        method: "POST",
        headers: { "Content-Type" : "application/json"},
        body: JSON.stringify({otp})

    });

    const data = await response.json();

    if (!data.success){

        registerOtpError.className = "alert alert-danger";
        registerOtpError.textContent = data.error;
        registerOtpError.style.display = "block";

    }else{
        
        console.log("verified");
        registerOtpError.textContent = data.message;
        registerOtpError.className = "alert alert-success";
        registerOtpError.style.display = "block";
        window.location.href = `${data.url}`;

    }

})
