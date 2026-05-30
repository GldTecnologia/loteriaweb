export class Pix {
  private chave: string
  private descricao: string
  private nome: string
  private cidade: string
  private txid: string
  private valor: string

  private normalizarChave(chave: string): string {
    const raw = String(chave || '').trim()
    if (!raw) return raw
    // E-mail: mantém como está
    if (raw.includes('@')) return raw
    // EVP (UUID): mantém como está
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return raw
    // Já está no formato E.164
    if (raw.startsWith('+')) return raw
    const digits = raw.replace(/\D/g, '')
    // Telefone com DDI 55: 12 dígitos (55 + DDD + 8) ou 13 (55 + DDD + 9)
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return `+${digits}`
    // Telefone sem DDI: 10 dígitos (DDD + 8) ou 11 (DDD + 9)
    if (digits.length === 10 || digits.length === 11) {
      const ddd = parseInt(digits.slice(0, 2), 10)
      if (ddd >= 11 && ddd <= 99) return `+55${digits}`
    }
    // CPF (11 dígitos), CNPJ (14 dígitos) e outros: retorna só dígitos
    return digits || raw
  }

  constructor(
    chave: string,
    descricao: string,
    nomeRecebedor: string,
    cidade: string,
    txid = '***',
    valor = 0
  ) {
    this.chave = this.normalizarChave(chave)
    this.descricao = (descricao || '').substring(0, 72)
    this.nome = this.sanitizar(nomeRecebedor, 25)
    this.cidade = this.sanitizar(cidade, 15)
    this.txid = (txid || '***').replace(/[^A-Za-z0-9]/g, '').substring(0, 25) || '***'
    this.valor = Number(valor || 0).toFixed(2)
  }

  private sanitizar(str: string, max: number): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .substring(0, max)
      .toUpperCase()
      .trim()
  }

  private f(id: string, value: string): string {
    const len = String(value.length).padStart(2, '0')
    return `${id}${len}${value}`
  }

  private crc16(str: string): string {
    let crc = 0xffff
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
        crc &= 0xffff
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
  }

  getPayload(): string {
    const mai =
      this.f('00', 'br.gov.bcb.pix') +
      this.f('01', this.chave) +
      (this.descricao ? this.f('02', this.descricao) : '')

    const adf = this.f('05', this.txid)

    let payload =
      this.f('00', '01') +
      this.f('26', mai) +
      this.f('52', '0000') +
      this.f('53', '986') +
      this.f('54', this.valor) +
      this.f('58', 'BR') +
      this.f('59', this.nome) +
      this.f('60', this.cidade) +
      this.f('62', adf) +
      '6304'

    return payload + this.crc16(payload)
  }
}
