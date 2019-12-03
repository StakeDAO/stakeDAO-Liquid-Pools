import Fixture from '../../livepeer-protocol/test/unit/helpers/Fixture'

contract('LivepeerAllocationStrategy', () => {

    let fixture

    before(async () => {
        fixture = new Fixture(web3)
        await fixture.deploy()


    })

    beforeEach(async () => {
        fixture.setUp()
    })

    afterEach(async () => {
        fixture.tearDown()
    })

    it("does something", async () => {

    })

})
