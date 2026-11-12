export interface PaymentResult {
  success: boolean;
  transactionId: string;
  message: string;
}

/**
 * Strategy Pattern: Permite a inclusão de novos métodos de pagamento
 * sem modificar a lógica do orquestrador (Princípio Aberto/Fechado - OCP).
 */
export interface PaymentStrategy {
  process(orderId: string, amount: number): Promise<PaymentResult>;
}

export class PixPaymentStrategy implements PaymentStrategy {
  async process(orderId: string, amount: number): Promise<PaymentResult> {
    // Simulação de gateway Pix instantâneo
    return {
      success: true,
      transactionId: `pix_tx_${Date.now()}_${orderId.slice(0, 6)}`,
      message: `Pagamento Pix de R$ ${amount.toFixed(2)} processado com sucesso.`
    };
  }
}

export class CreditCardPaymentStrategy implements PaymentStrategy {
  async process(orderId: string, amount: number): Promise<PaymentResult> {
    // Simulação de autorização de cartão
    return {
      success: true,
      transactionId: `card_tx_${Date.now()}_${orderId.slice(0, 6)}`,
      message: `Transação de cartão no valor de R$ ${amount.toFixed(2)} autorizada.`
    };
  }
}

export class BoletoPaymentStrategy implements PaymentStrategy {
  async process(orderId: string, amount: number): Promise<PaymentResult> {
    // Simulação de registro de boleto
    return {
      success: true,
      transactionId: `bol_tx_${Date.now()}_${orderId.slice(0, 6)}`,
      message: `Boleto de R$ ${amount.toFixed(2)} gerado para compensação.`
    };
  }
}

export class PaymentStrategyFactory {
  static getStrategy(method: string): PaymentStrategy {
    switch (method.toUpperCase()) {
      case "PIX":
        return new PixPaymentStrategy();
      case "CREDIT_CARD":
        return new CreditCardPaymentStrategy();
      case "BOLETO":
        return new BoletoPaymentStrategy();
      default:
        throw new Error(`Método de pagamento "${method}" não é suportado.`);
    }
  }
}

