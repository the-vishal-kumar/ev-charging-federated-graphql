export const getEnumKey = <T extends EnumType<T>>(
  enumObj: T,
  value: string | null | undefined,
): keyof T | string | null => {
  const enumKeys = Object.keys(enumObj) as Array<keyof T>;
  for (const key of enumKeys) {
    if (enumObj[key] === value) {
      return key;
    }
  }
  return value || null;
};

type EnumType<T> = {
  [K in keyof T]: T[K] extends string | number ? T[K] : null;
};

const Enum = <T extends EnumType<T>>(baseEnum: T): Readonly<EnumType<T> & { Null: null }> => {
  const enumWithNull = {
    ...baseEnum,
    Null: null,
  };

  return new Proxy(enumWithNull, {
    get: (_, name): unknown => {
      const propName = name.toString() as keyof T;
      if (!enumWithNull.hasOwnProperty(propName)) {
        throw new Error(`"${propName.toString()}" value does not exist in the enum`);
      }
      return enumWithNull[propName];
    },
    set: (): never => {
      throw new Error('Cannot modify or add a new value to the enum');
    },
  }) as Readonly<EnumType<T> & { Null: null }>;
};

export default Enum;
