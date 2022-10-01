var fs = require('fs');
const Crawler = require('./_crawler');
const crawler =  new Crawler();

//10 é a quantidade de produtos para buscar
const productsMax = 5
const provincy = "Recife"
crawler.search(productsMax, provincy).then( products => {

    //console.log(products);
    fs.writeFile(`${__dirname}/products.json`, JSON.stringify(products, null, 4), function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("The products file was saved!");
        }
    }); 

});