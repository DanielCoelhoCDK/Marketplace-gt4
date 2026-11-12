import { describe, it, expect } from "vitest";
import {
  PaymentStrategyFactory,
  PixPaymentStrategy,
  CreditCardPaymentStrategy,
  BoletoPaymentStrategy
} from "../../src/modules/payment/strategies/payment.strategy";

describe("Payment Strategy Pattern (Unit)", () => {
  it("deve instanciar PixPaymentStrategy para o método PIX", () => {
    const strategy = PaymentStrategyFactory.getStrategy("PIX");
    expect(strategy).toBeInstanceOf(PixPaymentStrategy);
  });

  it("deve instanciar CreditCardPaymentStrategy para CREDIT_CARD", () => {
    const strategy = PaymentStrategyFactory.getStrategy("CREDIT_CARD");
    expect(strategy).toBeInstanceOf(CreditCardPaymentStrategy);
  });

  it("deve instanciar BoletoPaymentStrategy para BOLETO", () => {
    const strategy = PaymentStrategyFactory.getStrategy("BOLETO");
    expect(strategy).toBeInstanceOf(BoletoPaymentStrategy);
  });

  it("deve lançar erro para método não suportado", () => {
    expect(() => PaymentStrategyFactory.getStrategy("CRYPTO")).toThrow(
      'Método de pagamento "CRYPTO" não é suportado.'
    );
  });

  it("deve processar pagamento Pix com sucesso gerando transactionId", async () => {
    const strategy = new PixPaymentStrategy();
    const result = await strategy.process("order-123", 250.0);

    expect(result.success).toBe(true);
    expect(result.transactionId).toContain("pix_tx_");
    expect(result.message).toContain("R$ 250.00");
  });

  it("deve processar pagamento Cartão com sucesso gerando transactionId", async () => {
    const strategy = new CreditCardPaymentStrategy();
    const result = await strategy.process("order-456", 1500.5);

    expect(result.success).toBe(true);
    expect(result.transactionId).toContain("card_tx_");
  });
});

