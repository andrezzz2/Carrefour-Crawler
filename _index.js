require('dotenv').config();

const Crawler = require('./_crawler');
const crawler =  new Crawler();
/*
const productsMax = 5
const provincy = "Recife"
const searchFrom = null
*/
crawler.search(process.env.PRODUCTS_MAX, process.env.PROVINCY, process.env.SEARCH_FROM).then( products => {

    var fs = require('fs');
    fs.writeFile(`${__dirname}/products.json`, JSON.stringify(products, null, 4), function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("The products file was saved!");
        }
    }); 

});