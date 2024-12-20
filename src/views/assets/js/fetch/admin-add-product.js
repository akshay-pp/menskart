let cropper;
let fileMap = new Map();

document.getElementById("image-input").addEventListener("change", function (e){

    const files = [...e.target.files];

    files.forEach(file => {
        fileMap.set(file.name, file);
    })

    console.log(e.target.files);
    console.log(fileMap);

    updateThumbnails();

})

function updateThumbnails(){

    const previewContainer = document.getElementById("preview-container");
    previewContainer.innerHTML = "";

    fileMap.forEach((file) =>{
        if(file.type.startsWith("image/")){
            const reader = new FileReader();
            reader.onload = function (e){

                const outerDiv = document.createElement("div");
                outerDiv.className = "d-flex  flex-column";
                outerDiv.id = file.name;

                const actionDiv = document.createElement("div");
                actionDiv.className = "d-flex justify-content-around";

                const crop = document.createElement("a");
                crop.className = "btn btn-sm font-sm rounded btn-light";
                const cropIcon = document.createElement("i");
                cropIcon.className = "material-icons md-crop";
                crop.appendChild(cropIcon);
                actionDiv.appendChild(crop);

                const remove = document.createElement("a");
                remove.className = "btn btn-sm font-sm btn-danger rounded";
                const removeIcon = document.createElement("i");
                removeIcon.className = "material-icons md-delete_forever";
                remove.appendChild(removeIcon);
                actionDiv.appendChild(remove);

                const thumbnail = document.createElement("img");
                thumbnail.src = e.target.result;
                thumbnail.alt = file.name;
                thumbnail.title = file.name;
                // thumbnail.id = file.name;
                thumbnail.classList.add("img-thumbnail");
                thumbnail.style.cursor = "pointer";
                // thumbnail.setAttribute("data-bs-toggle", "modal");
                // thumbnail.setAttribute("data-bs-target", "#cropperModal");
                outerDiv.appendChild(thumbnail);
                outerDiv.appendChild(actionDiv);
                previewContainer.appendChild(outerDiv);
                crop.addEventListener("click", () => openCropModal(e.target.result, file.name, thumbnail));
                remove.addEventListener("click", () => removeImage(file.name));
                fileMap.set(file.name, file)
            }
            reader.readAsDataURL(file);
        }
    })

}



function openCropModal(imageSrc, filename, thumbnail){

    const cropperImage = document.getElementById("cropperImage");

    cropperImage.src = imageSrc;

    const cropperModal = new bootstrap.Modal(document.getElementById("cropperModal"));
    cropperModal.show();

    cropperModal._element.addEventListener("shown.bs.modal", () => {

        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(cropperImage, {
            aspectRatio : 1,
            viewMode : 1
        });
        
    }, { once: true });

    cropperModal._element.addEventListener("hidden.bs.modal", () => {
        cropper.destroy();
        cropper = null;
        const cropButton = document.getElementById("cropButton");
        const newCropButton = cropButton.cloneNode(true);
        cropButton.replaceWith(newCropButton);
    }, { once: true });


    document.getElementById("cropButton").addEventListener("click", () => {
        const canvas = cropper.getCroppedCanvas();
        canvas.toBlob((blob) => {
            const croppedFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
            fileMap.set(filename, croppedFile);
            thumbnail.src = canvas.toDataURL();
            cropperModal.hide();
        }, "image/jpeg");
    }, { once: true });

}


function removeImage(key){
    fileMap.delete(key);
    document.getElementById(key).remove();
}



const form = document.getElementById("add-product-form");
form.addEventListener("submit", async (e) => {
    
    e.preventDefault();
    const formData = new FormData(form);
    formData.delete("images");
    fileMap.forEach((value,key) => {
        formData.append("images", value);
    })

    for (let [key, value] of formData.entries()) {
        console.log(key, value);
    }
    const payload = Object.fromEntries(formData);
    

})
