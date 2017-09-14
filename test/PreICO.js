const Crowdsale = artifacts.require('./ICO.sol');
const PreICO = artifacts.require('./PreICO.sol');
const TokenHolderFactory = artifacts.require('./TokenHolderFactory.sol');
const Token = artifacts.require('./Token.sol');

const BigNumber = web3.BigNumber;
const chai = require('chai');
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')(BigNumber));
const expect = chai.expect;

const h = require('../scripts/helper_functions.js');
const ether = h.ether;
const getBalance = h.getBalance;
const expectInvalidOpcode = h.expectInvalidOpcode;

contract("PreICO", async function([_, wallet, investor, signer]) {
	const investment = h.ether(1);
	const cap = ether(10);

	const oneDay = 3600;

	let startTime;
	let endTime;
	let token;
	let crowdsale;
	let factory;
	let rate;
	let unitsPerInvestment;

	beforeEach(async function() {
		startTime = h.latestTime() + oneDay;
		endTime = startTime + oneDay;

		token = await Token.new();
		factory = await TokenHolderFactory.new(token.address, signer, endTime);
		crowdsale = await PreICO.new(startTime, endTime, cap, wallet, token.address, factory.address);
		await token.transferOwnership(crowdsale.address);
		await factory.transferOwnership(crowdsale.address);
		rate = await crowdsale.getRate();
		unitsPerInvestment = investment.times(rate);
	});

	it("should have token", async function() {
		expect(await crowdsale.token()).to.be.equal(token.address);
	});

	it("should instantiate token holder factory", async function() {
		expect(await crowdsale.factory()).to.exist;
	});

	it("should have constant price", async function() {
		expect(await crowdsale.getRate()).to.be.bignumber.equal(rate);
	});

	it("should increase amount in wei", async function() {
		await h.setTime(startTime);
		await crowdsale.buyTokens({value: investment, from: investor});

		expect(await crowdsale.weiRaised()).to.be.bignumber.equal(investment);
	});

	it("should increase balance of locked account", async function() {
		await h.setTime(startTime);

		const tx = await crowdsale.buyTokens({value: investment, from: investor});
		const account = tx.logs[0].args.lockedAccount;

		expect(await token.balanceOf(account)).to.be.bignumber.equal(unitsPerInvestment);
		expect(await token.balanceOf(investor)).to.be.bignumber.equal(0);
	});

	it("should forward funds to owner", async function() {
		await h.setTime(startTime);

		const walletBalanceBefore = await getBalance(wallet);
		const investorBalanceBefore = await getBalance(investor);

		await crowdsale.buyTokens({value: investment, from: investor});

		const walletBalanceAfter = await getBalance(wallet);
		const investorBalanceAfter = await getBalance(investor);

		expect(walletBalanceAfter).to.be.bignumber.above(walletBalanceBefore);
		expect(investorBalanceAfter).to.be.bignumber.below(investorBalanceBefore);
	});

	it("should fail to receive payments before start", async function() {
		expectInvalidOpcode(crowdsale.buyTokens({value: investment, from: investor}));
	});
});