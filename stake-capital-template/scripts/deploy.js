const deployTemplate = require('@aragon/templates-shared/scripts/deploy-template')

const TEMPLATE_NAME = 'stake-capital-template'
const CONTRACT_NAME = 'StakeCapitalTemplate'

const NETWORK_ARG = '--network'
const network = process.argv.includes(NETWORK_ARG) ? process.argv[process.argv.indexOf(NETWORK_ARG) + 1] === "rinkeby" : "development"
const templateName = network === 'rinkeby' ? TEMPLATE_NAME + '.open' : TEMPLATE_NAME

module.exports = callback => {
    deployTemplate(web3, artifacts, templateName, CONTRACT_NAME)
        .then(template => {
            console.log(template.address)
            callback()
        })
        .catch(callback)
}