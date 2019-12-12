const StakeCapitalTemplate = artifacts.require("StakeCapitalTemplate")
const Token = artifacts.require("Token")
const Vault = artifacts.require("Vault")
const MiniMeToken = artifacts.require("MiniMeToken")
const TokenWrapper = artifacts.require("TokenWrapper")

const STAKE_CAPITAL_TEMPLATE_ADDRESS = "0x79662191c7c2d63ed524009f85660dd17ccb696e"
const VAULT_APP_ID = "0x7e852e0fcfce6551c13800f1e7476f982525c2b5277ba14b24339c68416336d1";

const STAKE_CAPITAL_DAO_ID = "stake-capital-test13" // This ID must be unique, change it for each new deployment or a revert will occur

const TEAM_VOTING_TOKEN_NAME = "Stake Capital Owners"
const TEAM_VOTING_TOKEN_SYMBOL = "SCO"
const TEAM_VOTING_MEMBERS = ["0xb4124ceb3451635dacedd11767f004d8a28c6ee7"]
const TEAM_VOTING_MEMBERS_WEIGHTS = ["1000000000000000000"] // 10^18 == 1
const TEAM_VOTING_PARAMS = ["500000000000000000", "300000000000000000", "3000"] // [supportRequired, minAcceptanceQuorum, voteDuration] 10^16 == 1%

const SCT_VOTING_TOKEN_NAME = "Wrapped Stake Capital Token"
const SCT_VOTING_TOKEN_SYMBOL = "wSCT"
const SCT_VOTING_PARAMS = ["500000000000000000", "300000000000000000", "3000"] // [supportRequired, minAcceptanceQuorum, voteDuration] 10^16 == 1%

const TEST_ACCOUNT_2_SCT_BALANCE = "5000000000000000000000" // 5000 SCT
const VAULT_DAI_BALANCE = "10000000000000000000000" // 10000 DAI

module.exports = async () => {
    try {

        const [account1, account2] = await web3.eth.getAccounts()
        //
        // console.log(`Creating SCT token...`)
        // let sct = await Token.new(account1, "Stake Capital Token", "SCT")
        // console.log(`SCT Token created: ${sct.address} Transferring SCT to account2...`)
        // await sct.transfer(account2, TEST_ACCOUNT_2_SCT_BALANCE)
        // console.log(`Account1 SCT balance: ${await sct.balanceOf(account1)} Account2 SCT balance: ${await sct.balanceOf(account2)}`)
        //
        let template = await StakeCapitalTemplate.at(STAKE_CAPITAL_TEMPLATE_ADDRESS)

        console.log(`\nCreating vote tokens...`)
        const newTokensReceipt = await template.newTokens(
            TEAM_VOTING_TOKEN_NAME,
            TEAM_VOTING_TOKEN_SYMBOL,
            SCT_VOTING_TOKEN_NAME,
            SCT_VOTING_TOKEN_SYMBOL)

        console.log(`Voting tokens created. Gas used: ${newTokensReceipt.receipt.gasUsed}`)
        console.log(`wSCT Token Address: ${newTokensReceipt.logs.filter(x => x.event === "DeployToken")[1].args.token}`)

        const deployedContracts = await template.deployedContracts(account1)
        console.log(deployedContracts)


        console.log(`\nCreating DAO...`)
        let newDaoReceipt = await template.newInstance(
            STAKE_CAPITAL_DAO_ID,
            TEAM_VOTING_MEMBERS,
            TEAM_VOTING_MEMBERS_WEIGHTS,
            TEAM_VOTING_PARAMS,
            SCT_VOTING_PARAMS,
            "0x78B391b3f9f5CbC971698848AFA7C7DeE02E00C6")
            // sct.address)

        console.log(`New DAO created at: ${newDaoReceipt.logs.find(x => x.event === "DeployDao").args.dao} Gas used: ${newDaoReceipt.receipt.gasUsed}`)

        const tokenWrapper = newDaoReceipt.logs.find(x => x.event === "DEBUG").args.tokenWrapper
        console.log(tokenWrapper)
        console.log(await (await MiniMeToken.at(deployedContracts[1])).controller())
        console.log(await (await TokenWrapper.at(tokenWrapper)).hasInitialized())


        // console.log(`\nCreating DAI token...`)
        // let dai = await Token.new(account1, "Dai", "DAI")
        // console.log(`DAI Token created: ${dai.address}`)
        //
        // const vaultProxyAddress = newDaoReceipt.logs.find(x => x.event === "InstalledApp" && x.args.appId === VAULT_APP_ID).args.appProxy
        // const vault = await Vault.at(vaultProxyAddress)
        // console.log(`Approve and transfer DAI to Vault...`)
        // await dai.approve(vaultProxyAddress, VAULT_DAI_BALANCE)
        // await vault.deposit(dai.address, VAULT_DAI_BALANCE)
        // console.log(`Vault DAI balance: ${await dai.balanceOf(vault.address)}`)

    } catch (error) {
        console.log(error)
    }
    process.exit()
}