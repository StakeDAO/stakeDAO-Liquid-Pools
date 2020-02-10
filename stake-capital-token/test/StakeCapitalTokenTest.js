const StakeCapitalToken = artifacts.require('StakeCapitalToken')
const singletons = require('@openzeppelin/test-helpers/src/singletons')

const BN = require('bn.js')
const numberWithDecimals = (number) => new BN(number).mul(new BN(10).pow(new BN(18)))

contract('StakeCapitalToken', ([stakeCapitalOrg]) => {

    let erc1820Registry, stakeCapitalToken
    const TOTAL_SUPPLY = numberWithDecimals(100000000)

    beforeEach(async () => {
        erc1820Registry = await singletons.ERC1820Registry(stakeCapitalOrg)
        stakeCapitalToken = await StakeCapitalToken.new(TOTAL_SUPPLY, { from: stakeCapitalOrg })
    })

    it('sends initially minted tokens to the creator', async () => {
        const balanceString = (await stakeCapitalToken.balanceOf(stakeCapitalOrg)).toString()
        assert.equal(balanceString, TOTAL_SUPPLY.toString())
    })
})