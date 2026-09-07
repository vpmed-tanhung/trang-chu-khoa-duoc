/* =========================================================
 * MODULE 4 — PET/CT DOSE CALCULATOR
 * Tính hoạt độ mục tiêu, bù phân rã và thể tích cần rút
 * ========================================================= */

(function (window) {
  'use strict';

  /* =========================================================
   * 1. CHUYỂN ĐỔI ĐƠN VỊ
   * ========================================================= */

  function mCiToMBq(mci) {
    var value = Number(mci);

    if (!Number.isFinite(value)) {
      return NaN;
    }

    return value * 37;
  }

  function mBqToMci(mbq) {
    var value = Number(mbq);

    if (!Number.isFinite(value)) {
      return NaN;
    }

    return value / 37;
  }


  /* =========================================================
   * 2. PHÂN RÃ PHÓNG XẠ
   * ========================================================= */

  /**
   * Hệ số hoạt độ còn lại sau dt phút.
   *
   * A(t) = A0 × 2^(-t/T½)
   *
   * @param {number} dtMinutes
   * @param {number} halfLifeMinutes
   * @returns {number}
   */
  function decayFactor(dtMinutes, halfLifeMinutes) {
    var dt = Number(dtMinutes);
    var halfLife = Number(halfLifeMinutes);

    if (
      !Number.isFinite(dt) ||
      !Number.isFinite(halfLife) ||
      halfLife <= 0
    ) {
      return NaN;
    }

    return Math.exp(
      -Math.log(2) * dt / halfLife
    );
  }


  /* =========================================================
   * 3. DỮ LIỆU DƯỢC CHẤT PHÓNG XẠ
   * ========================================================= */

  var TRACER_DATA = {
    F18: {
      id: 'F18',
      name: 'F-18 FDG',
      halfLifeMin: 109.8,
      doseRange: '3,5–5,0 MBq/kg',
      midDoseMBqKg: 4.0,
      indication:
        'Ung thư, tim mạch, thần kinh'
    },

    GA68: {
      id: 'GA68',
      name: 'Ga-68 DOTATATE',
      halfLifeMin: 68.3,
      doseRange: '2,0–2,5 MBq/kg',
      midDoseMBqKg: 2.25,
      indication:
        'U thần kinh nội tiết'
    },

    C11: {
      id: 'C11',
      name: 'C-11 Choline',
      halfLifeMin: 20.4,
      doseRange: '4,0–7,0 MBq/kg',
      midDoseMBqKg: 5.5,
      indication:
        'Tái phát ung thư tuyến tiền liệt'
    },

    N13: {
      id: 'N13',
      name: 'N-13 Ammonia',
      halfLifeMin: 10.0,
      doseRange: '10,0–15,0 MBq/kg',
      midDoseMBqKg: 12.5,
      indication:
        'Tưới máu cơ tim'
    }
  };


  /* =========================================================
   * 4. HÀM HỖ TRỢ
   * ========================================================= */

  function normalizeDoseUnit(unit) {
    var text = String(unit || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

    if (
      text === 'mbqkg' ||
      text === 'mbq/kg'
    ) {
      return 'MBqKg';
    }

    if (
      text === 'mcikg' ||
      text === 'mci/kg'
    ) {
      return 'mCiKg';
    }

    return null;
  }


  function getTracer(tracerId) {
    if (!tracerId) {
      return null;
    }

    var key = String(tracerId)
      .trim()
      .toUpperCase()
      .replace(/[-_\s]/g, '');

    if (key === 'F18') {
      return TRACER_DATA.F18;
    }

    if (key === 'GA68') {
      return TRACER_DATA.GA68;
    }

    if (key === 'C11') {
      return TRACER_DATA.C11;
    }

    if (key === 'N13') {
      return TRACER_DATA.N13;
    }

    return null;
  }


  function minutesBetween(startTime, endTime) {
    var start = new Date(startTime);
    var end = new Date(endTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return NaN;
    }

    return (
      end.getTime() -
      start.getTime()
    ) / 60000;
  }


  /* =========================================================
   * 5. TÍNH HOẠT ĐỘ MỤC TIÊU THEO CÂN NẶNG
   * ========================================================= */

  function calculateTargetActivity(
    weightKg,
    doseFactor,
    doseUnit
  ) {
    var weight = Number(weightKg);
    var factor = Number(doseFactor);
    var unit = normalizeDoseUnit(doseUnit);

    if (
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      return {
        error:
          'Cân nặng phải lớn hơn 0.'
      };
    }

    if (
      !Number.isFinite(factor) ||
      factor <= 0
    ) {
      return {
        error:
          'Hệ số liều phải lớn hơn 0.'
      };
    }

    if (!unit) {
      return {
        error:
          'Đơn vị hệ số liều không hợp lệ.'
      };
    }

    var targetMBq;
    var targetMci;

    if (unit === 'mCiKg') {
      targetMci =
        weight * factor;

      targetMBq =
        mCiToMBq(targetMci);
    } else {
      targetMBq =
        weight * factor;

      targetMci =
        mBqToMci(targetMBq);
    }

    return {
      weightKg: weight,
      doseFactor: factor,
      doseUnit: unit,

      targetMBq: targetMBq,
      targetMci: targetMci
    };
  }


  /* =========================================================
   * 6. TÍNH LIỀU PET/CT + BÙ PHÂN RÃ + THỂ TÍCH RÚT
   * ========================================================= */

  /**
   * @param {Object} p
   *
   * p.weightKg
   * p.doseFactor
   * p.doseUnit
   * p.halfLifeMin
   * p.waitMinutes
   *
   * Có thể nhập trực tiếp:
   * p.concentrationMciMl
   *
   * Hoặc:
   * p.stockActivityMci
   * p.stockVolumeMl
   */
  function calcPetctDose(p) {
    p = p || {};

    var weightKg =
      Number(p.weightKg);

    var doseFactor =
      Number(p.doseFactor);

    var doseUnit =
      normalizeDoseUnit(
        p.doseUnit
      );

    var halfLifeMin =
      Number(p.halfLifeMin);

    var waitMinutes =
      Number(p.waitMinutes);

    var concentrationMciMl =
      Number(
        p.concentrationMciMl
      );

    var stockActivityMci =
      Number(
        p.stockActivityMci
      );

    var stockVolumeMl =
      Number(
        p.stockVolumeMl
      );


    /*
     * Kiểm tra cơ bản.
     */
    if (
      !Number.isFinite(weightKg) ||
      weightKg <= 0
    ) {
      return {
        error:
          'Cân nặng phải lớn hơn 0.'
      };
    }

    if (
      !Number.isFinite(doseFactor) ||
      doseFactor <= 0
    ) {
      return {
        error:
          'Hệ số liều phải lớn hơn 0.'
      };
    }

    if (!doseUnit) {
      return {
        error:
          'Đơn vị hệ số liều không hợp lệ.'
      };
    }

    if (
      !Number.isFinite(halfLifeMin) ||
      halfLifeMin <= 0
    ) {
      return {
        error:
          'Chu kỳ bán rã phải lớn hơn 0.'
      };
    }

    if (
      !Number.isFinite(waitMinutes) ||
      waitMinutes < 0
    ) {
      return {
        error:
          'Thời gian chờ không hợp lệ.'
      };
    }


    /*
     * Hoạt độ mục tiêu tại thời điểm tiêm.
     */
    var targetResult =
      calculateTargetActivity(
        weightKg,
        doseFactor,
        doseUnit
      );

    if (targetResult.error) {
      return targetResult;
    }

    var targetMci =
      targetResult.targetMci;

    var targetMBq =
      targetResult.targetMBq;


    /*
     * Hệ số phân rã từ thời điểm rút
     * đến thời điểm tiêm.
     */
    var decay =
      decayFactor(
        waitMinutes,
        halfLifeMin
      );

    if (
      !Number.isFinite(decay) ||
      decay <= 0
    ) {
      return {
        error:
          'Không thể tính hệ số phân rã.'
      };
    }


    /*
     * Hoạt độ phải có tại thời điểm rút.
     *
     * A_draw × decay = A_target
     *
     * => A_draw = A_target / decay
     */
    var drawNeededMci =
      targetMci / decay;

    var drawNeededMBq =
      mCiToMBq(
        drawNeededMci
      );


    /*
     * Xác định nồng độ nguồn.
     */
    var conc;

    if (
      Number.isFinite(
        concentrationMciMl
      ) &&
      concentrationMciMl > 0
    ) {
      conc =
        concentrationMciMl;
    } else {
      if (
        !Number.isFinite(
          stockActivityMci
        ) ||
        stockActivityMci <= 0
      ) {
        return {
          error:
            'Cần nhập nồng độ hoạt độ hoặc tổng hoạt độ lọ thuốc.'
        };
      }

      if (
        !Number.isFinite(
          stockVolumeMl
        ) ||
        stockVolumeMl <= 0
      ) {
        return {
          error:
            'Thể tích lọ thuốc phải lớn hơn 0.'
        };
      }

      conc =
        stockActivityMci /
        stockVolumeMl;
    }


    if (
      !Number.isFinite(conc) ||
      conc <= 0
    ) {
      return {
        error:
          'Không thể xác định nồng độ hoạt độ.'
      };
    }


    /*
     * Thể tích cần rút.
     */
    var volumeToDrawMl =
      drawNeededMci /
      conc;


    return {
      weightKg: weightKg,

      doseFactor: doseFactor,
      doseUnit: doseUnit,

      halfLifeMin: halfLifeMin,
      waitMinutes: waitMinutes,

      targetMci: targetMci,
      targetMBq: targetMBq,

      /*
       * Giữ tên cũ để tương thích nếu code khác
       * đang sử dụng targetMbq.
       */
      targetMbq: targetMBq,

      decayFactor: decay,

      /*
       * Hệ số bù = 1 / hệ số còn lại.
       */
      correctionFactor:
        1 / decay,

      drawNeededMci:
        drawNeededMci,

      drawNeededMBq:
        drawNeededMBq,

      drawNeededMbq:
        drawNeededMBq,

      concentrationMciMl:
        conc,

      concentrationMBqMl:
        mCiToMBq(conc),

      volumeToDrawMl:
        volumeToDrawMl
    };
  }


  /* =========================================================
   * 7. TÍNH LIỀU THỰC TẾ ĐÃ TIÊM
   * ========================================================= */

  /**
   * Hoạt độ thực tiêm =
   * hoạt độ trước tiêm
   * -
   * tồn dư quy đổi về thời điểm tiêm.
   */
  function calcActualInjectedDose(
    activityBeforeInjectMci,
    residualActivityMeasuredMci,
    residualDelayMinutes,
    halfLifeMin
  ) {
    var before =
      Number(
        activityBeforeInjectMci
      );

    var residualMeasured =
      Number(
        residualActivityMeasuredMci
      );

    var delay =
      Number(
        residualDelayMinutes
      );

    var halfLife =
      Number(
        halfLifeMin
      );


    if (
      !Number.isFinite(before) ||
      before < 0
    ) {
      return {
        error:
          'Hoạt độ trước tiêm không hợp lệ.'
      };
    }

    if (
      !Number.isFinite(residualMeasured) ||
      residualMeasured < 0
    ) {
      return {
        error:
          'Hoạt độ tồn dư không hợp lệ.'
      };
    }

    if (
      !Number.isFinite(delay) ||
      delay < 0
    ) {
      return {
        error:
          'Thời gian đo tồn dư không hợp lệ.'
      };
    }

    if (
      !Number.isFinite(halfLife) ||
      halfLife <= 0
    ) {
      return {
        error:
          'Chu kỳ bán rã không hợp lệ.'
      };
    }


    var factor =
      decayFactor(
        delay,
        halfLife
      );

    if (
      !Number.isFinite(factor) ||
      factor <= 0
    ) {
      return {
        error:
          'Không thể tính phân rã hoạt độ tồn dư.'
      };
    }


    /*
     * Quy hoạt độ tồn dư đo sau đó
     * về thời điểm vừa tiêm xong.
     */
    var residualAtInjectTime =
      residualMeasured /
      factor;

    var actualInjectedMci =
      before -
      residualAtInjectTime;


    if (actualInjectedMci < 0) {
      return {
        error:
          'Hoạt độ tồn dư quy đổi lớn hơn hoạt độ trước tiêm. Kiểm tra lại số liệu và thời điểm đo.'
      };
    }


    return {
      activityBeforeInjectMci:
        before,

      residualMeasuredMci:
        residualMeasured,

      residualDelayMinutes:
        delay,

      residualAtInjectTime:
        residualAtInjectTime,

      actualInjectedMci:
        actualInjectedMci,

      actualInjectedMBq:
        mCiToMBq(
          actualInjectedMci
        )
    };
  }


  /* =========================================================
   * 8. HOẠT ĐỘ CÒN LẠI SAU MỘT KHOẢNG THỜI GIAN
   * ========================================================= */

  function calcRemainingActivity(
    activityDrawnMci,
    waitMinutes,
    halfLifeMin
  ) {
    var activity =
      Number(
        activityDrawnMci
      );

    var wait =
      Number(
        waitMinutes
      );

    var halfLife =
      Number(
        halfLifeMin
      );

    if (
      !Number.isFinite(activity) ||
      activity < 0 ||
      !Number.isFinite(wait) ||
      wait < 0 ||
      !Number.isFinite(halfLife) ||
      halfLife <= 0
    ) {
      return NaN;
    }

    return (
      activity *
      decayFactor(
        wait,
        halfLife
      )
    );
  }


  /* =========================================================
   * 9. TÍNH THEO THỜI ĐIỂM THỰC TẾ
   * ========================================================= */

  /**
   * Tính bù phân rã bằng 2 mốc datetime.
   */
  function calcDecayBetweenTimes(
    activityAtStart,
    startTime,
    endTime,
    halfLifeMin
  ) {
    var activity =
      Number(activityAtStart);

    var halfLife =
      Number(halfLifeMin);

    var elapsed =
      minutesBetween(
        startTime,
        endTime
      );

    if (
      !Number.isFinite(activity) ||
      activity < 0
    ) {
      return {
        error:
          'Hoạt độ ban đầu không hợp lệ.'
      };
    }

    if (
      !Number.isFinite(elapsed) ||
      elapsed < 0
    ) {
      return {
        error:
          'Thời điểm kết thúc phải sau thời điểm bắt đầu.'
      };
    }

    if (
      !Number.isFinite(halfLife) ||
      halfLife <= 0
    ) {
      return {
        error:
          'Chu kỳ bán rã không hợp lệ.'
      };
    }

    var factor =
      decayFactor(
        elapsed,
        halfLife
      );

    var remaining =
      activity * factor;

    return {
      elapsedMinutes:
        elapsed,

      decayFactor:
        factor,

      activityRemaining:
        remaining,

      correctionFactor:
        1 / factor
    };
  }


  /* =========================================================
   * 10. API MODULE 4
   * ========================================================= */

  var PETCT_DOSE_API = {
    TRACER_DATA:
      TRACER_DATA,

    mCiToMBq:
      mCiToMBq,

    mBqToMci:
      mBqToMci,

    decayFactor:
      decayFactor,

    normalizeDoseUnit:
      normalizeDoseUnit,

    getTracer:
      getTracer,

    minutesBetween:
      minutesBetween,

    calculateTargetActivity:
      calculateTargetActivity,

    calcPetctDose:
      calcPetctDose,

    calcActualInjectedDose:
      calcActualInjectedDose,

    calcRemainingActivity:
      calcRemainingActivity,

    calcDecayBetweenTimes:
      calcDecayBetweenTimes
  };


  /* =========================================================
   * 11. EXPORT CHO TRÌNH DUYỆT
   * ========================================================= */

  if (
    typeof window !==
    'undefined'
  ) {
    window.TRACER_DATA =
      TRACER_DATA;

    window.mCiToMBq =
      mCiToMBq;

    window.mBqToMci =
      mBqToMci;

    window.decayFactor =
      decayFactor;

    window.getTracer =
      getTracer;

    window.calcPetctDose =
      calcPetctDose;

    window.calcActualInjectedDose =
      calcActualInjectedDose;

    window.calcRemainingActivity =
      calcRemainingActivity;

    window.calcDecayBetweenTimes =
      calcDecayBetweenTimes;

    window.PETCT_DOSE_API =
      PETCT_DOSE_API;
  }


  /* =========================================================
   * 12. EXPORT CHO NODE / TEST
   * ========================================================= */

  if (
    typeof module !== 'undefined' &&
    module.exports
  ) {
    module.exports =
      PETCT_DOSE_API;
  }

}(typeof window !== 'undefined' ? window : globalThis));