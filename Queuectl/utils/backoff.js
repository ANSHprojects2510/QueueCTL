
function getbackoffdelay(base,attempt){
    return base**attempt*1000;
}

module.exports={getbackoffdelay};
