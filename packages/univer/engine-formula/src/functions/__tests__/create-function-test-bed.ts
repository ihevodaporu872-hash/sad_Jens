/**
 * Copyright 2023-present DreamNum Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { stripErrorMargin } from '../../engine/utils/math-kit';

export function stripArrayValue(value: any): any {
    if (Array.isArray(value)) {
        return value.map((row) => {
            if (Array.isArray(row)) {
                return row.map((cell) => {
                    if (typeof cell === 'number') {
                        return stripErrorMargin(cell);
                    }
                    return cell;
                });
            }
            if (typeof row === 'number') {
                return stripErrorMargin(row);
            }
            return row;
        });
    }
    if (typeof value === 'number') {
        return stripErrorMargin(value);
    }
    return value;
}
