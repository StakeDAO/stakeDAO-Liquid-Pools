const ERC20Mintable = artifacts.require("ERC20Mintable");
const CErc20 = artifacts.require("CErc20");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
const RToken = artifacts.require("RToken");
const Proxy = artifacts.require("Proxy");
const { time, expectRevert } = require("openzeppelin-test-helpers");
const { web3tx, wad4human, toWad } = require("@decentral.ee/web3-test-helpers");

contract("RToken", accounts => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const bingeBorrower = accounts[1];
    const customer1 = accounts[2];
    const customer2 = accounts[3];
    const customer3 = accounts[4];
    const customer4 = accounts[5];
    let token;
    let cToken;
    let compoundAS;
    let rToken;
    let rTokenLogic;
    let SELF_HAT_ID;


    async function createCompoundAllocationStrategy(cTokenExchangeRate) {
        const comptroller = await web3tx(ComptrollerMock.new, "ComptrollerMock.new")({from: admin});
        const interestRateModel = await web3tx(InterestRateModelMock.new, "InterestRateModelMock.new")({from: admin});
        const cToken = await web3tx(CErc20.new, "CErc20.new")(
            token.address,
            comptroller.address,
            interestRateModel.address,
            cTokenExchangeRate, // 1 cToken == cTokenExchangeRate * token
            "Compound token",
            "cToken",
            18, {
                from: admin
            });
        const compoundAS = await web3tx(CompoundAllocationStrategy.new, "CompoundAllocationStrategy.new")(
            cToken.address, {
                from: admin
            }
        );
        return {cToken, compoundAS};
    }

    before(async () => {
        console.log("admin is", admin);
        console.log("bingeBorrower is", bingeBorrower);
        console.log("customer1 is", customer1);
        console.log("customer2 is", customer2);
        console.log("customer3 is", customer3);
    });

    beforeEach(async () => {
        token = await web3tx(ERC20Mintable.new, "ERC20Mintable.new")({from: admin});
        await web3tx(token.mint, "token.mint 1000 -> customer1")(customer1, toWad(1000), {from: admin});
        await web3tx(token.mint, "token.mint 1000 -> customer2")(customer2, toWad(1000), {from: admin});

        {
            const result = await createCompoundAllocationStrategy(toWad(.1));
            cToken = result.cToken;
            compoundAS = result.compoundAS;
        }

        // Deploy the rToken logic/library contract
        rTokenLogic = await web3tx(RToken.new, "RToken.new")(
            {
                from: admin
            });
        // Get the init code for rToken
        const rTokenConstructCode = rTokenLogic.contract.methods.initialize(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18).encodeABI();

        // Deploy the Proxy, using the init code for rToken
        const proxy = await web3tx(Proxy.new, "Proxy.new")(
            rTokenConstructCode, rTokenLogic.address, {
                from: admin
            });
        // Create the rToken object using the proxy address
        rToken = await RToken.at(proxy.address);

        await web3tx(compoundAS.transferOwnership, "compoundAS.transferOwnership")(rToken.address);
        SELF_HAT_ID = await rToken.SELF_HAT_ID.call();
    });

    async function doBingeBorrowing(nBlocks = 100) {
        // this process should generate 0.0001% * nBlocks amount of tokens worth of interest
        // when nBlocks = 100, it is 0.001

        console.log(`Before binge borrowing: 1 cToken = ${wad4human(await cToken.exchangeRateStored.call())} Token`);
        // for testing purpose, our mock doesn't even check if there is
        // sufficient collateral in the system!!
        const borrowAmount = toWad(10);
        await web3tx(cToken.borrow, "cToken.borrow 10 to bingeBorrower", {
            inLogs: [{
                name: "Borrow"
            }]
        })(borrowAmount, {
            from: bingeBorrower
        });
        await waitForInterest(nBlocks);
        console.log(`After binge borrowing: 1 cToken = ${wad4human(await cToken.exchangeRateStored.call())} Token`);
    }

    async function waitForInterest(nBlocks = 100) {
        console.log(`Wait for ${nBlocks} blocks...`);
        while (--nBlocks) await time.advanceBlock();
        await web3tx(cToken.accrueInterest, "cToken.accrueInterest")({from: admin});
    }

    async function expectAccount(account, balances, decimals) {
        let accountName;
        if (account === admin) accountName = "admin";
        else if (account === customer1) accountName = "customer1";
        else if (account === customer2) accountName = "customer2";
        else if (account === customer3) accountName = "customer3";
        else if (account === customer4) accountName = "customer4";

        const tokenBalance = wad4human(await rToken.balanceOf.call(account), decimals);
        console.log(`${accountName} tokenBalance ${tokenBalance} expected ${balances.tokenBalance}`);

        const receivedLoan = wad4human(await rToken.receivedLoanOf.call(account), decimals);
        console.log(`${accountName} receivedLoan ${receivedLoan} expected ${balances.receivedLoan}`);

        const receivedSavings = wad4human(await rToken.receivedSavingsOf.call(account), decimals);
        console.log(`${accountName} receivedSavings ${receivedSavings} expected ${balances.receivedSavings}`);

        const interestPayable = wad4human(await rToken.interestPayableOf.call(account), decimals);
        console.log(`${accountName} interestPayable ${interestPayable} expected ${balances.interestPayable}`);

        const accountStats = await rToken.getAccountStats.call(account);

        const cumulativeInterest = wad4human(accountStats.cumulativeInterest, decimals);
        console.log(`${accountName} cumulativeInterest ${cumulativeInterest} expected ${balances.cumulativeInterest}`);

        assert.equal(tokenBalance, balances.tokenBalance, `${accountName} tokenBalance`);
        assert.equal(receivedLoan, balances.receivedLoan, `${accountName} receivedLoan`);
        assert.equal(receivedSavings, balances.receivedSavings, `${accountName} receivedSavings`);
        assert.equal(interestPayable, balances.interestPayable, `${accountName} interestPayable`);
        assert.equal(cumulativeInterest, balances.cumulativeInterest, `${accountName} cumulativeInterest`);
    }

    async function printAccount(account, decimals) {
        let accountName;
        if (account === admin) accountName = "admin";
        else if (account === customer1) accountName = "customer1";
        else if (account === customer2) accountName = "customer2";
        else if (account === customer3) accountName = "customer3";
        else if (account === customer4) accountName = "customer4";

        const tokenBalance = wad4human(await rToken.balanceOf.call(account), decimals);
        console.log(`${accountName} tokenBalance ${tokenBalance}`);

        const receivedLoan = wad4human(await rToken.receivedLoanOf.call(account), decimals);
        console.log(`${accountName} receivedLoan ${receivedLoan}`);

        const receivedSavings = wad4human(await rToken.receivedSavingsOf.call(account), decimals);
        console.log(`${accountName} receivedSavings ${receivedSavings}`);

        const interestPayable = wad4human(await rToken.interestPayableOf.call(account), decimals);
        console.log(`${accountName} interestPayable ${interestPayable}`);

        const accountStats = await rToken.getAccountStats.call(account);

        const cumulativeInterest = wad4human(accountStats.cumulativeInterest, decimals);
        console.log(`${accountName} cumulativeInterest ${cumulativeInterest}`);

        const rInterest = accountStats.rInterest;
        console.log(`${accountName} rInterest ${rInterest}`);

        const sInternalAmount = accountStats.sInternalAmount;
        console.log(`${accountName} sInternalAmount ${sInternalAmount}`);

        const lDebt = accountStats.lDebt;
        console.log(`${accountName} lDebt ${lDebt}`);

        const rAmount = accountStats.rAmount;
        console.log(`${accountName} rAmount ${rAmount}`);
    }

    it("#0 initial test condition", async () => {
        assert.equal(wad4human(await rToken.totalSupply.call()), "0.00000");
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "1000.00000");
    });

    it.only("#2 rToken normal operations with zero hatter", async () => {
        console.log("\n\n");
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1,
                    value: toWad(100)
                }
            }]
        })(toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");

        console.log(`   Exchange rate initially: ${await cToken.exchangeRateStored()}`);

        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });


        await doBingeBorrowing();

        // await expectRevert(rToken.transfer(customer2, toWad(100.1), {from: customer1}), "Not enough balance to transfer");
        // await expectRevert(rToken.transferFrom(customer1, customer2, toWad(1), {from: admin}), "Not enough allowance for transfer");

        console.log(`   Exchange rate after binge borrowing: ${await cToken.exchangeRateStored()}`);

        await printAccount(customer1, 18);


        await web3tx(token.approve, "token.approve 100 by customer2")(rToken.address, toWad(100), {
            from: customer2
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer2", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer2,
                    value: toWad(100)
                }
            }]
        })(toWad(100), {
            from: customer2
        });

        console.log(`   Exchange rate after minting for customer 2: ${await cToken.exchangeRateStored()}`);

        await printAccount(customer1, 18);

        await printAccount(customer2, 18);



        await web3tx(rToken.payInterest, "rToken.payInterest to customer1", {
            inLogs: [{
                name: "InterestPaid"
            }, {
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1
                    // value: // who knows
                }
            }]
        })(customer1, {from: admin});

        console.log(`   Exchange rate after payInterest to customer 1: ${await cToken.exchangeRateStored()}`);

        await printAccount(customer1, 18);


        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(10)
                }
            }]
        })(toWad(10), {
            from: customer1
        });

        console.log(`   Exchange rate after redeem to customer 1: ${await cToken.exchangeRateStored()}`);

        await printAccount(customer1, 18);


        // assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        // assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "90.00101");
        // await expectAccount(customer1, {
        //     tokenBalance: "90.00101",
        //     cumulativeInterest: "0.00101",
        //     receivedLoan: "90.00000",
        //     receivedSavings: "90.00101",
        //     interestPayable: "0.00000",
        // });
    });
});
