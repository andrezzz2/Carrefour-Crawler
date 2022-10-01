require("chromedriver");
const {Builder, By, until} = require('selenium-webdriver');
const logger = require('./_logger');

class Crawler{

    constructor(){
        this.productsURLs = [];
        this.carrefourURL = "https://mercado.carrefour.com.br/";
        this.products = [];
        this.skuId = {};
    }

    async search(productsMax, provincy){

        let driver = await new Builder().forBrowser('chrome').build();

        await driver.get(this.carrefourURL);

        //part 1, escolher o mercado
        try{
            await driver.wait(until.elementLocated(By.className('css-1he143')), 5000).click();
        } catch (error) {
            logger.error(error.name);
            await driver.wait(until.elementIsVisible(driver.findElement(By.className('css-1he143'))), 2000).click();
        }

        await driver.wait(until.elementLocated(By.className('searchPickupPointsSelect')), 3000);

        try{
            await driver.wait(until.elementLocated(By.css(`option[value="${provincy}"]`)), 3000).click();
        } catch (error) {
            logger.error(error.name);
            await driver.wait(until.elementIsVisible(driver.findElement(By.css(`option[value="${provincy}"]`))), 3000).click();
        }

        await driver.wait(until.elementLocated(By.className('css-11sx5j3')), 2000);
        let markets = await driver.findElements(By.className('css-11sx5j3'));
        let totalOfMarkets = markets.length;
        
        if(totalOfMarkets>0){
        
            await markets[0].click();
            
            //part 2, adicionando na lista de urls todos os produtos achados na pagina principal
            logger.info("Procurando produtos na página principal");
            await this.searchURLsOnThePage(driver);
            //part 3, pra cada produto adicionado salvar informaçoes e procurar mais produtos na pagina
            //ate a quantidade de produtos ser igual productsMax
            for (let productURL of this.productsURLs) {
                logger.info("-----------------------------------------------------------------------------------------------\n");
                await driver.get(productURL);
                await this.getProductInfoOnThePage(driver);
                await this.searchURLsOnThePage(driver);
                if(this.products.length>=productsMax){
                    logger.info("-----------------------------------------------------------------------------------------------\n");
                    logger.info("Chegou no limite máximo de produtos");
                    break;
                }
                
            }

        } else {
            //não tem mercados na regiao recife
            logger.info(`Não encontrou mercados em ${provincy}`);
        }

        //terminou de fazer as buscas
        await driver.quit();
        return this.products;

    }

    async searchURLsOnThePage(driver) {

        try{
            await driver.wait(until.elementLocated(By.className('css-1yflmu0')), 10000);
        } catch (error) {
            logger.error(`Não conseguiu achar produtos na página (${error.name})`);
            return ;
        }
        let productElements = await driver.findElements(By.className('css-1yflmu0'));

        for (let product of productElements) {
            try{
                let hrefValue = await product.getAttribute("href");
                this.productsURLs.push(hrefValue);
            } catch (error) {
                if(error.name!="StaleElementReferenceError"){
                    logger.error(error.name);
                    return;
                }
            }
        }
        
    }

    async getProductInfoOnThePage (driver) {

        let strURL = String(await driver.getCurrentUrl());
        logger.info(`URL atual ${strURL}`);
        const skuIdPos = strURL.search(/skuId=\d/i);
        let URLSkuId = strURL.substring(skuIdPos+6, strURL.length);
        logger.info(`SkuId encontrado ${URLSkuId}`);
        if(this.skuId[URLSkuId]){
            logger.info(`Produto já cadastrado ${URLSkuId}`);
            return;
        } 

        let nameString = "";
        try{    
            const productNameEl = await driver.wait(until.elementLocated(By.className('css-10fxcvv')), 3000);
            nameString = await productNameEl.getText();
        } catch (error) {
            if(error.name!="StaleElementReferenceError"){
                logger.error(`Não conseguiu achar elemento correspondente ao nome do produto (${error.name})`);
                logger.info(`Abortando cadastro de produto ${URLSkuId}`);
                return;
            }
        }

        let brandString = "";
        try{    
            const productBrandEl = await driver.wait(until.elementLocated(By.css('.css-67q0n5 a')), 3000);
            brandString = await productBrandEl.getText();
        } catch (error) {
            if(error.name!="StaleElementReferenceError"){
                logger.error(`Não conseguiu achar elemento correspondente a marca do produto (${error.name})`);
                logger.info(`Abortando cadastro de produto ${URLSkuId}`);
                return;
            }
        }
        
        let priceString = "";
        try{

            const productPriceEl = await driver.wait(until.elementLocated(By.css('[data-testid="offerPrice"]')), 5000);
            priceString = await productPriceEl.getText();

        } catch (error) {
            if(error.name!="StaleElementReferenceError"){
                logger.error(`Não conseguiu achar elemento correspondente ao preço do produto (${error.name})`);
                try{
                    const esgotadoEl = await driver.wait(until.elementLocated(By.css('[data-testid="offerSoldOut"]')), 5000);
                    priceString = await esgotadoEl.getText();
                } catch (error) {
                    if(error.name!="StaleElementReferenceError"){
                        logger.error(`Não conseguiu achar elemento correspondente ao esgotamento do produto (${error.name})`);
                        logger.info(`Abortando cadastro de produto ${URLSkuId}`);
                        return;
                    }
                }
            }
        }

        logger.info(`Cadastrando Produto ${URLSkuId}`);
        await this.createProductObject(nameString, brandString, priceString, strURL);
        this.skuId[URLSkuId] = true;

    }

    async createProductObject(nameString, brandString, priceString, productURL) {

        let nameStringSplited = nameString.split(" ");
        let nameStringJoined = nameStringSplited.join('');
        nameStringJoined = nameStringJoined.replace(',', '.');
        const priceStringSplited = priceString.split(" ");

        let units = 1;
        let quantity = 0;
        let measure = "";
        
        let initialPosition = nameStringJoined.search(/\d+unidades?/i);
        if(initialPosition > -1){
            let finalPosition = nameStringJoined.search(/unidades?/i);
            units = nameStringJoined.substring(initialPosition, finalPosition);
        }
        
        initialPosition = nameStringJoined.search(/(\d+.)?\d+gramas?/i);
        if(initialPosition > -1){
            measure = "gramas";
            let finalPosition = nameStringJoined.search(/gramas?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);
            
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+g/i);
        if(initialPosition > -1){
            measure = "gramas";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/g/i);
            quantity = allAfterQuantity.substring(0, finalPosition);
           
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+quilogramas?/i);
        if(initialPosition > -1){
            measure = "quilogramas";
            let finalPosition = nameStringJoined.search(/quilogramas?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);
            
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+kilogramas?/i);
        if(initialPosition > -1){
            measure = "quilogramas";
            let finalPosition = nameStringJoined.search(/kilogramas?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);
            
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+kg/i);
        if(initialPosition > -1){
            measure = "quilogramas";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/kg/i);
            quantity = allAfterQuantity.substring(0, finalPosition);
            
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+litros?/i);
        if(initialPosition > -1){
            measure = "litros";
            let finalPosition = nameStringJoined.search(/litros?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);
            
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+l/i);
        if(initialPosition > -1){
            measure = "litros";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/l/i);
            quantity = allAfterQuantity.substring(0, finalPosition);
            
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+mililitros?/i);
        if(initialPosition > -1){
            measure = "mililitros";
            let finalPosition = nameStringJoined.search(/mililitros?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);
            
            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+ml/i);
        if(initialPosition > -1){
            measure = "mililitros";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/ml/i);
            quantity = allAfterQuantity.substring(0, finalPosition);

            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+metros?/i);
        if(initialPosition > -1){
            measure = "metros";
            let finalPosition = nameStringJoined.search(/metros?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);

            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+m/i);
        if(initialPosition > -1){
            measure = "metros";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/m/i);
            quantity = allAfterQuantity.substring(0, finalPosition);

            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+centimetros?/i);
        if(initialPosition > -1){
            measure = "centimetros";
            let finalPosition = nameStringJoined.search(/centimetros?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);

            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+cm/i);
        if(initialPosition > -1){
            measure = "metros";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/cm/i);
            quantity = allAfterQuantity.substring(0, finalPosition);

            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+milimetros?/i);
        if(initialPosition > -1){
            measure = "milimetros";
            let finalPosition = nameStringJoined.search(/milimetros?/i);
            quantity = nameStringJoined.substring(initialPosition, finalPosition);

            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/(\d+.)?\d+mm/i);
        if(initialPosition > -1){
            measure = "milimetros";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/mm/i);
            quantity = allAfterQuantity.substring(0, finalPosition);

            this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
            logger.info(JSON.stringify(this.products[this.products.length-1]));
            logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
            return ;
        }

        initialPosition = nameStringJoined.search(/\d+rolos?/i);
        if(initialPosition > -1){
            measure = "rolos";
            let allAfterQuantity = nameStringJoined.substring(initialPosition, nameStringJoined.length);
            let finalPosition = allAfterQuantity.search(/rolos?/i);
            quantity = allAfterQuantity.substring(0, finalPosition);
        }

        this.products.push({name: nameString, quantity: quantity, measure: measure, units: units, brand: brandString, price: priceStringSplited[1], URL: productURL});
        logger.info(JSON.stringify(this.products[this.products.length-1]));
        logger.info(`Quantidade de produtos cadastrados ${this.products.length}`);
    }

}

module.exports = Crawler;