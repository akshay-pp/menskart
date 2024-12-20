const blockBtn = document.querySelectorAll("#blockUserModalBtn");


blockBtn.forEach(button => {
    
    button.addEventListener("click", function() {

        const userdata = this.getAttribute("data-user");
        const user = JSON.parse(userdata);
        console.log(user);
        document.getElementById("block-modal-content").textContent = user.isBlocked ? `Unblock ${user.fullname} ?` : `Block ${user.fullname} ?` ;
        const form = document.getElementById("confirm-block-form");
        const confirmButton = document.getElementById("confirm-block-btn");
        confirmButton.textContent = user.isBlocked ? `Unblock ${user.fullname}` : `Block ${user.fullname}` ;
        confirmButton.className = user.isBlocked ? "btn btn-success text-white" : "btn btn-danger";
        form.action = user.isBlocked ? `/api/admin/u/block/${user._id}/unblock`: `/api/admin/u/block/${user._id}`; 
    
    })
})