const videoElem = document.querySelector('video');
const button = document.querySelector('button');

document.onload = async () => {
console.log("pop-up loaded");
}


button.onclick = async ()=>{
    videoElem.hidden = false;
    videoElem.onplaying = async ()=>{
        let pip = await videoElem.requestPictureInPicture();
        console.log(`Picture-in-Picture size: ${pip.width}x${pip.height}`);
    }
}

async function main(){
    const stream = await navigator.mediaDevices.getUserMedia({video: {width: 320}});
    videoElem.srcObject = stream;
}

main().catch(err=>console.error(err));
