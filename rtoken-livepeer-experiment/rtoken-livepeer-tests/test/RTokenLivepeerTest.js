import Fixture from '../../livepeer-protocol/test/unit/helpers/Fixture'
const ERC20Mintable = artifacts.require("ERC20Mintable")
const LivepeerAllocationStrategy = artifacts.require("LivepeerAllocationStrategy")
const RToken = artifacts.require("RToken")

const { toWad } = require("@decentral.ee/web3-test-helpers")

contract('RToken using LivepeerAllocationStrategy', ([admin, stakeCapitalPoolDelegator, stakeCapitalTranscoder, staker1]) => {

    let fixture
    let livepeerToken, livepeerAllocationStrategy, rToken

    before(async () => {
        fixture = new Fixture(web3)
        await fixture.deploy()
    })

    beforeEach(async () => {
        await fixture.setUp()

        livepeerToken = await ERC20Mintable.new()
        await livepeerToken.mint(staker1, toWad(1000))

        livepeerAllocationStrategy = await LivepeerAllocationStrategy
            .new(livepeerToken.address, fixture.bondingManager.address, stakeCapitalPoolDelegator, stakeCapitalTranscoder)

        rToken = await RToken.new()
        await rToken.initialize(livepeerAllocationStrategy.address, "RToken Test", "RTOKEN", 18)

        await livepeerAllocationStrategy.transferOwnership(rToken.address)
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    it("mints expected amount", async () => {
        await livepeerToken.approve(rToken.address, toWad(100), { from: staker1 })
        // await rToken.mint(toWad(100), { from: staker1 })
    })

})
