import { AcGePoint3dLike } from '@mlightcad/data-model'

import { AcSvgEntity } from './AcSvgEntity'

export class AcSvgLine extends AcSvgEntity {
  constructor(points: AcGePoint3dLike[]) {
    super()
    const d = points.reduce(
      (acc: string, point: AcGePoint3dLike, i: number) => {
        acc += i === 0 ? 'M' : 'L'
        acc += point.x + ',' + point.y
        this.box.expandByPoint(point)
        return acc
      },
      ''
    )

    if (d) {
      this.svg = `<path d="${d}" />`
    }
  }
}
