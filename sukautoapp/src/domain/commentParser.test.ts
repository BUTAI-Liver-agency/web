import { describe, it, expect } from 'vitest'
import { parsePastedComments, parseCsv } from './commentParser'

describe('parsePastedComments', () => {
  it('@ハンドル + 本文の行を候補者行に変換する', () => {
    const input = `@yuki_live ライバー気になります！
@mio.0401 詳しく知りたいです`
    const result = parsePastedComments(input)
    expect(result.rows).toEqual([
      { tiktokHandle: 'yuki_live', displayName: 'yuki_live', commentText: 'ライバー気になります！' },
      { tiktokHandle: 'mio.0401', displayName: 'mio.0401', commentText: '詳しく知りたいです' },
    ])
    expect(result.unparsedLines).toEqual([])
  })

  it('空行を無視する', () => {
    const result = parsePastedComments('\n@a_b テスト\n\n\n')
    expect(result.rows).toHaveLength(1)
    expect(result.unparsedLines).toEqual([])
  })

  it('ハンドルを小文字に正規化し、前後の空白を落とす', () => {
    const result = parsePastedComments('  @Yuki_LIVE   こんにちは  ')
    expect(result.rows[0].tiktokHandle).toBe('yuki_live')
    expect(result.rows[0].commentText).toBe('こんにちは')
  })

  it('@で始まらない行は unparsedLines に入れて捨てない', () => {
    const result = parsePastedComments('返信 12件\n@yuki_live はい')
    expect(result.rows).toHaveLength(1)
    expect(result.unparsedLines).toEqual(['返信 12件'])
  })

  it('本文が空の行は unparsedLines に入れる', () => {
    const result = parsePastedComments('@yuki_live')
    expect(result.rows).toHaveLength(0)
    expect(result.unparsedLines).toEqual(['@yuki_live'])
  })
})

describe('parseCsv', () => {
  it('handle,display_name,comment のヘッダ付きCSVを読む', () => {
    const input = `handle,display_name,comment
yuki_live,ゆき,興味あります
mio.0401,みお,詳しく`
    const result = parseCsv(input)
    expect(result.rows).toEqual([
      { tiktokHandle: 'yuki_live', displayName: 'ゆき', commentText: '興味あります' },
      { tiktokHandle: 'mio.0401', displayName: 'みお', commentText: '詳しく' },
    ])
  })

  it('本文中のカンマを保持する（3列目以降を結合する）', () => {
    const input = `handle,display_name,comment
yuki_live,ゆき,はい,やってみたいです`
    const result = parseCsv(input)
    expect(result.rows[0].commentText).toBe('はい,やってみたいです')
  })

  it('列が足りない行は unparsedLines に入れる', () => {
    const input = `handle,display_name,comment
yuki_live,ゆき`
    const result = parseCsv(input)
    expect(result.rows).toHaveLength(0)
    expect(result.unparsedLines).toEqual(['yuki_live,ゆき'])
  })

  it('ヘッダが無く、ハンドルが handle で始まる行を取りこぼさない', () => {
    const result = parseCsv('handleyuki,ゆき,興味あります')
    expect(result.rows).toEqual([
      { tiktokHandle: 'handleyuki', displayName: 'ゆき', commentText: '興味あります' },
    ])
    expect(result.unparsedLines).toEqual([])
  })

  it('大文字のヘッダ行も読み飛ばす', () => {
    const input = `Handle,Display_Name,Comment
yuki_live,ゆき,興味あります`
    const result = parseCsv(input)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].tiktokHandle).toBe('yuki_live')
  })
})
