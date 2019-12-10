const StakeCapitalTemplate = artifacts.require("StakeCapitalTemplate")
const Token = artifacts.require("Token")

const STAKE_CAPITAL_TEMPLATE_ADDRESS = "0x574d77389826c62a17d27b923291c7e215b2a94d"
const STAKE_CAPITAL_DAO_ID = "stake-capital-ad" // This ID must be unique, change it for each new deployment or a revert will occur

const TEAM_VOTING_TOKEN = "Stake Capital Team"
const TEAM_VOTING_TOKEN_SYMBOL = "SCO"
const TEAM_VOTING_MEMBERS = ["0xb4124ceb3451635dacedd11767f004d8a28c6ee7"]
const TEAM_VOTING_MEMBERS_WEIGHTS = ["1000000000000000000"] // 10^18 == 1
const TEAM_VOTING_PARAMS = ["500000000000000000", "300000000000000000", "3000"] // [supportRequired, minAcceptanceQuorum, voteDuration] 10^16 == 1%

const SCT_VOTING_TOKEN = "Stake Capital Stakers"
const SCT_VOTING_TOKEN_SYMBOL = "SCS"
const SCT_VOTING_PARAMS = ["500000000000000000", "300000000000000000", "3000"] // [sup

module.exports = async () => {
    try {

        console.log(`Creating SCT token...`)
        let sctToken = await Token.new("Stake Capital Token", "SCT")
        let template = await StakeCapitalTemplate.at(STAKE_CAPITAL_TEMPLATE_ADDRESS)

        console.log(`Creating vote tokens...`)
        const newTokensReceipt = await template.newTokens(
            TEAM_VOTING_TOKEN,
            TEAM_VOTING_TOKEN_SYMBOL,
            SCT_VOTING_TOKEN,
            SCT_VOTING_TOKEN_SYMBOL)

        console.log(`Voting tokens created. Gas used: ${newTokensReceipt.receipt.gasUsed}\n`)

        console.log(`Creating DAO...`)
        let newDaoReceipt = await template.newInstance(
            STAKE_CAPITAL_DAO_ID,
            TEAM_VOTING_MEMBERS,
            TEAM_VOTING_MEMBERS_WEIGHTS,
            TEAM_VOTING_PARAMS,
            SCT_VOTING_PARAMS,
            sctToken.address)

        console.log(`New DAO created at: ${newDaoReceipt.logs.find(x => x.event === "DeployDao").args.dao} Gas used: ${newDaoReceipt.receipt.gasUsed}\n`)

    } catch (error) {
        console.log(error)
    }
    process.exit()
}