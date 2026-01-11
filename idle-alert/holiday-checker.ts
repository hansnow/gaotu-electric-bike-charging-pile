/**
 * 节假日检查器模块
 *
 * @remarks
 * 负责从 iCloud 日历拉取中国节假日数据，缓存到数据库，并判断某日期是否为工作日
 * 数据源：https://calendars.icloud.com/holidays/cn_zh.ics
 */

/**
 * 节假日缓存接口
 */
interface HolidayCache {
  date: string; // YYYY-MM-DD
  is_holiday: number; // 1=节假日，0=工作日
  holiday_name: string | null;
  cached_at: number; // Unix 时间戳
  source: string;
}

/**
 * 节假日检查器接口
 */
export interface HolidayChecker {
  /**
   * 判断指定日期是否为工作日
   * @param date 日期对象
   * @returns true=工作日，false=非工作日（周末或节假日）
   */
  isWorkday(date: Date): Promise<boolean>;

  /**
   * 刷新节假日缓存
   * @param days 刷新未来多少天的数据（默认 365 天）
   */
  refresh(days?: number): Promise<void>;
}

/**
 * 创建节假日检查器实例
 *
 * @param db D1 数据库实例
 * @param fetchImpl fetch 实现（默认使用全局 fetch，可注入用于测试）
 * @returns 节假日检查器实例
 */
export function createHolidayChecker(
  db: D1Database,
  fetchImpl: typeof fetch = fetch
): HolidayChecker {
  /**
   * 判断指定日期是否为工作日
   */
  async function isWorkday(date: Date): Promise<boolean> {
    const dateStr = formatDate(date);

    try {
      // 先尝试从缓存读取
      const cached = await db
        .prepare('SELECT * FROM holiday_cache WHERE date = ?')
        .bind(dateStr)
        .first<HolidayCache>();

      if (cached) {
        // 检查缓存是否过期（超过 30 天）
        const now = Math.floor(Date.now() / 1000);
        const cacheAge = now - cached.cached_at;
        const thirtyDays = 30 * 24 * 60 * 60;

        if (cacheAge < thirtyDays) {
          // 缓存有效
          return cached.is_holiday === 0;
        } else {
          console.warn(
            `[IDLE_ALERT] 节假日缓存已过期 (${Math.floor(cacheAge / 86400)} 天)，尝试刷新`
          );
        }
      }

      // 缓存缺失或过期，尝试刷新
      await refresh(365);

      // 重新读取
      const refreshed = await db
        .prepare('SELECT * FROM holiday_cache WHERE date = ?')
        .bind(dateStr)
        .first<HolidayCache>();

      if (refreshed) {
        return refreshed.is_holiday === 0;
      }

      // 如果刷新后仍然没有数据，回退到周末逻辑
      console.warn(`[IDLE_ALERT] 节假日数据缺失，回退到周末判断: ${dateStr}`);
      return !isWeekend(date);
    } catch (error) {
      console.error('[IDLE_ALERT] 节假日查询失败:', error);
      // 容错：回退到周末逻辑
      return !isWeekend(date);
    }
  }

  /**
   * 刷新节假日缓存
   */
  async function refresh(days: number = 365): Promise<void> {
    try {
      console.log(`[IDLE_ALERT] 开始刷新节假日缓存，未来 ${days} 天`);

      // 拉取 iCloud 日历
      const icsUrl = 'https://calendars.icloud.com/holidays/cn_zh.ics';
      const response = await fetchImpl(icsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Cloudflare Worker)',
        },
      });

      if (!response.ok) {
        throw new Error(`ICS 请求失败: ${response.status} ${response.statusText}`);
      }

      const icsText = await response.text();

      // 解析 ICS 文件
      const holidays = parseICS(icsText);

      if (holidays.length === 0) {
        throw new Error('ICS 解析结果为空');
      }

      console.log(`[IDLE_ALERT] 解析到 ${holidays.length} 个节假日事件`);

      // 生成未来 N 天的缓存数据
      const cacheDates = generateDateRange(new Date(), days);

      // 创建节假日映射表
      // 注意：如果同一天有多个事件，调休补班日（班）优先级高于节假日（休）
      const holidayMap = new Map<
        string,
        { isHoliday: boolean; name: string }
      >();
      for (const holiday of holidays) {
        const existing = holidayMap.get(holiday.date);
        // 如果已存在且已存在的是节假日，新的是调休补班日，则覆盖
        if (!existing || (!holiday.isHoliday && existing.isHoliday)) {
          holidayMap.set(holiday.date, {
            isHoliday: holiday.isHoliday,
            name: holiday.name,
          });
        }
      }

      // 使用批处理写入数据库（每批 100 条）
      const batchSize = 100;
      const now = Math.floor(Date.now() / 1000);

      for (let i = 0; i < cacheDates.length; i += batchSize) {
        const batch = cacheDates.slice(i, i + batchSize);

        // 使用事务批量写入
        const statements = batch.map((dateStr) => {
          const holidayInfo = holidayMap.get(dateStr);
          let isHoliday = 0;

          if (holidayInfo) {
            // 如果在 holidayMap 中：
            //   - isHoliday=true → is_holiday=1（节假日）
            //   - isHoliday=false → is_holiday=0（调休补班日，需要上班）
            isHoliday = holidayInfo.isHoliday ? 1 : 0;
          } else {
            // 如果不在 holidayMap 中，需要判断是否为周末
            // 将 dateStr (YYYY-MM-DD) 转换为 Date 对象
            const [year, month, day] = dateStr.split('-').map(Number);
            // 注意：这里使用 UTC 时间创建 Date，因为 dateStr 已经是北京时间的日期
            const dateObj = new Date(Date.UTC(year, month - 1, day));

            // 判断是否为周末（使用 UTC 时间，因为 dateStr 已经是北京时间）
            const dayOfWeek = dateObj.getUTCDay();
            const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6; // 周日=0，周六=6

            // 周末标记为非工作日（is_holiday=1），平日标记为工作日（is_holiday=0）
            isHoliday = isWeekendDay ? 1 : 0;
          }

          return db
            .prepare(
              `INSERT OR REPLACE INTO holiday_cache
              (date, is_holiday, holiday_name, cached_at, source)
              VALUES (?, ?, ?, ?, ?)`
            )
            .bind(dateStr, isHoliday, holidayInfo?.name || null, now, 'apple_ical');
        });

        // 批量执行
        await db.batch(statements);
      }

      console.log(`[IDLE_ALERT] 节假日缓存刷新成功，共写入 ${cacheDates.length} 条记录`);
    } catch (error) {
      console.error('[IDLE_ALERT] 节假日缓存刷新失败:', error);
      // 不抛出异常，允许回退到周末逻辑
    }
  }

  return { isWorkday, refresh };
}

/**
 * 解析 ICS 文件，提取节假日信息
 *
 * @param icsText ICS 文件内容
 * @returns 节假日列表
 *
 * @remarks
 * 支持以下特性：
 * 1. 单日事件（只有 DTSTART）
 * 2. 时间段事件（DTSTART + DTEND），会展开为多个日期
 * 3. 区分节假日（休）和调休补班日（班）
 */
export function parseICS(
  icsText: string
): { date: string; name: string; isHoliday: boolean }[] {
  const holidays: { date: string; name: string; isHoliday: boolean }[] = [];

  // 按行分割
  const lines = icsText.split(/\r?\n/);

  let inEvent = false;
  let currentStartDate = '';
  let currentEndDate = '';
  let currentSummary = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // 检测事件开始
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentStartDate = '';
      currentEndDate = '';
      currentSummary = '';
      continue;
    }

    // 检测事件结束
    if (trimmed === 'END:VEVENT') {
      if (currentStartDate && currentSummary) {
        // 仅识别明确标注（休/班）的事件，避免节气等误判为节假日
        const isRestDay = currentSummary.includes('（休）');
        const isWorkday = currentSummary.includes('（班）');

        if (!isRestDay && !isWorkday) {
          inEvent = false;
          continue;
        }

        const isHoliday = isRestDay;

        // 如果有结束日期，展开为多个日期
        if (currentEndDate) {
          const startDate = new Date(currentStartDate + 'T00:00:00Z');
          const endDate = new Date(currentEndDate + 'T00:00:00Z');

          // 注意：ICS 的 DTEND 是 exclusive 的，不包含结束日期当天
          let currentDate = new Date(startDate);
          while (currentDate < endDate) {
            const dateStr = formatDateStr(currentDate);
            holidays.push({
              date: dateStr,
              name: currentSummary,
              isHoliday: isHoliday,
            });
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        } else {
          // 单日事件
          holidays.push({
            date: currentStartDate,
            name: currentSummary,
            isHoliday: isHoliday,
          });
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    // 提取开始日期（DTSTART;VALUE=DATE:20260101）
    if (trimmed.startsWith('DTSTART')) {
      const match = trimmed.match(/DTSTART[^:]*:(\d{8})/);
      if (match) {
        const dateStr = match[1]; // 20260101
        currentStartDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      }
    }

    // 提取结束日期（DTEND;VALUE=DATE:20260104）
    if (trimmed.startsWith('DTEND')) {
      const match = trimmed.match(/DTEND[^:]*:(\d{8})/);
      if (match) {
        const dateStr = match[1]; // 20260104
        currentEndDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      }
    }

    // 提取摘要（SUMMARY:元旦（休）或 SUMMARY;LANGUAGE=zh_CN:元旦（班））
    if (trimmed.startsWith('SUMMARY')) {
      const match = trimmed.match(/SUMMARY[^:]*:(.+)/);
      if (match) {
        currentSummary = match[1];
      }
    }
  }

  return holidays;
}

/**
 * 将 Date 对象格式化为 YYYY-MM-DD（UTC时间）
 *
 * @param date Date 对象
 * @returns YYYY-MM-DD 格式的字符串
 */
function formatDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 生成日期范围（YYYY-MM-DD 格式）
 *
 * @param startDate 开始日期
 * @param days 天数
 * @returns 日期字符串数组
 */
function generateDateRange(startDate: Date, days: number): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  for (let i = 0; i < days; i++) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 格式化日期为 YYYY-MM-DD(北京时间)
 *
 * @param date 日期对象(UTC时间)
 * @returns YYYY-MM-DD 格式的字符串(北京时间)
 *
 * @remarks
 * 在 Cloudflare Worker 中,Date 对象默认使用 UTC 时区。
 * 为了正确判断北京时间的日期,需要先转换为北京时间(UTC+8)再格式化。
 * 这样可以确保节假日判断使用的是北京时间的日期,而不是 UTC 日期。
 */
export function formatDate(date: Date): string {
  // 转换为北京时间 (UTC+8)
  const bjOffset = 8 * 60 * 60 * 1000; // 8小时
  const bjDate = new Date(date.getTime() + bjOffset);

  const year = bjDate.getUTCFullYear();
  const month = String(bjDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bjDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 判断是否为周末(北京时间)
 *
 * @param date 日期对象(UTC时间)
 * @returns true=周末，false=工作日
 *
 * @remarks
 * 在 Cloudflare Worker 中，Date 对象默认使用 UTC 时区。
 * 为了正确判断北京时间的星期几，需要先转换为北京时间(UTC+8)。
 */
export function isWeekend(date: Date): boolean {
  // 转换为北京时间 (UTC+8)
  const bjOffset = 8 * 60 * 60 * 1000; // 8小时
  const bjDate = new Date(date.getTime() + bjOffset);

  const day = bjDate.getUTCDay();
  return day === 0 || day === 6; // 周日=0，周六=6
}
