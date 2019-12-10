const StakeCapitalTemplate = artifacts.require("StakeCapitalTemplate")

const STAKE_CAPITAL_TEMPLATE_ADDRESS = "0x0dc2584acd49d9552109e31ecf05e81d956bdd59"
const STAKE_CAPITAL_DAO_ID = "stake-capital" // This ID must be unique, change it for each new deployment or a revert will occur

module.exports = async () => {
    try {

        let template = await StakeCapitalTemplate.at(STAKE_CAPITAL_TEMPLATE_ADDRESS)

        console.log(`Creating DAO...`)
        let receipt = await template.newTokenAndInstance("Test", "TST", STAKE_CAPITAL_DAO_ID, ["0xb4124ceb3451635dacedd11767f004d8a28c6ee7"], ["1000000000000000000"], ["10000000000000000", "10000000000000000", "3000"], true)

        console.log(`New DAO created at: ${receipt.logs.find(x => x.event === "DeployDao").args.dao}\n`)

    } catch (error) {
        console.log(error)
    }
}