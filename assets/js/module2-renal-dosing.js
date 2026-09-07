/* =========================================================
 * MODULE 2
 * CrCl (Cockcroft-Gault) + hỗ trợ chỉnh liều theo chức năng thận
 * Nomogram Vancomycin hiện có trong module
 * ========================================================= */

(function (window) {
  'use strict';


  /* =========================================================
   * 1. IDEAL BODY WEIGHT — IBW
   * ========================================================= */

  function calcIBW(heightCm, sex) {
    const height = Number(heightCm);

    if (
      !Number.isFinite(height) ||
      height <= 0
    ) {
      return NaN;
    }

    const heightIn =
      height / 2.54;

    const base =
      sex === 'female'
        ? 45.5
        : 50;

    return (
      base +
      2.3 *
      Math.max(
        0,
        heightIn - 60
      )
    );
  }


  /* =========================================================
   * 2. ADJUSTED BODY WEIGHT — AdjBW
   * ========================================================= */

  function calcAdjustedDosingWeight(
    actualWeightKg,
    ibwKg
  ) {
    const actual =
      Number(actualWeightKg);

    const ibw =
      Number(ibwKg);

    if (
      !Number.isFinite(actual) ||
      actual <= 0 ||
      !Number.isFinite(ibw) ||
      ibw <= 0
    ) {
      return null;
    }

    /*
     * Chỉ dùng AdjBW khi:
     * cân nặng thực ≥ 120% IBW
     */
    if (
      actual >=
      1.2 * ibw
    ) {
      return (
        ibw +
        0.4 *
        (actual - ibw)
      );
    }

    return null;
  }


  /* =========================================================
   * 3. COCKCROFT-GAULT
   * ========================================================= */

  /**
   * Công thức với SCr µmol/L:
   *
   * CrCl =
   * N × (140 − tuổi) × cân nặng / SCr
   *
   * N:
   * Nam = 1.23
   * Nữ = 1.04
   *
   * Quy tắc cân nặng:
   *
   * - Actual weight < IBW:
   *      dùng actual weight
   *
   * - Actual weight ≥ 1.2 × IBW:
   *      dùng AdjBW
   *
   * - Còn lại:
   *      dùng IBW
   */
  function calcCrCl_CockcroftGault(params) {
    params = params || {};

    const ageYears =
      Number(params.ageYears);

    const weightKg =
      Number(params.weightKg);

    const heightCm =
      Number(params.heightCm);

    const sex =
      params.sex;

    const scrUmolL =
      Number(params.scrUmolL);


    if (
      !Number.isFinite(ageYears) ||
      ageYears < 18 ||
      !Number.isFinite(weightKg) ||
      weightKg <= 0 ||
      !Number.isFinite(heightCm) ||
      heightCm <= 0 ||
      !Number.isFinite(scrUmolL) ||
      scrUmolL <= 0
    ) {
      return null;
    }


    const ibw =
      calcIBW(
        heightCm,
        sex
      );


    if (
      !Number.isFinite(ibw) ||
      ibw <= 0
    ) {
      return null;
    }


    const adjBW =
      calcAdjustedDosingWeight(
        weightKg,
        ibw
      );


    let crclWeight;


    /*
     * Nhẹ hơn IBW:
     * dùng cân nặng thực.
     */
    if (
      weightKg <
      ibw
    ) {
      crclWeight =
        weightKg;
    }

    /*
     * ≥120% IBW:
     * dùng AdjBW.
     */
    else if (
      adjBW !== null
    ) {
      crclWeight =
        adjBW;
    }

    /*
     * Từ IBW tới <120% IBW:
     * dùng IBW.
     */
    else {
      crclWeight =
        ibw;
    }


    const N =
      sex === 'female'
        ? 1.04
        : 1.23;


    const crcl =
      (
        (140 - ageYears) *
        crclWeight *
        N
      ) /
      scrUmolL;


    return {
      crcl:
        crcl,

      ibw:
        ibw,

      adjBW:
        adjBW,

      crclWeight:
        crclWeight,

      actualWeightKg:
        weightKg
    };
  }


  /*
   * Alias không có dấu _
   * để tránh lỗi nếu code khác gọi tên này.
   */
  const calcCrClCockcroftGault =
    calcCrCl_CockcroftGault;


  /* =========================================================
   * 4. QUY ĐỔI CREATININE
   * ========================================================= */

  function scrMgdlToUmol(mgdl) {
    const value =
      Number(mgdl);

    if (
      !Number.isFinite(value)
    ) {
      return NaN;
    }

    return (
      value *
      88.4
    );
  }


  function scrUmolToMgdl(umol) {
    const value =
      Number(umol);

    if (
      !Number.isFinite(value)
    ) {
      return NaN;
    }

    return (
      value /
      88.4
    );
  }


  /* =========================================================
   * 5. ADAPTER CHO clinical-tools.js
   * ========================================================= */

  /**
   * clinical-tools.js hiện truyền:
   *
   * ageYears
   * sex
   * heightCm
   * weightKg
   * scrMgDl
   *
   * Hàm này chuyển SCr mg/dL → µmol/L
   * rồi gọi lõi Cockcroft-Gault của Module 2.
   */
  function computeRenalCore(
    ageYears,
    sex,
    heightCm,
    weightKg,
    scrMgDl
  ) {
    const age =
      Number(ageYears);

    const height =
      Number(heightCm);

    const weight =
      Number(weightKg);

    const scr =
      Number(scrMgDl);


    if (
      !Number.isFinite(age) ||
      age < 18 ||
      !Number.isFinite(height) ||
      height <= 0 ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isFinite(scr) ||
      scr <= 0
    ) {
      return null;
    }


    const scrUmolL =
      scrMgdlToUmol(
        scr
      );


    const core =
      calcCrCl_CockcroftGault({
        ageYears:
          age,

        weightKg:
          weight,

        heightCm:
          height,

        sex:
          sex,

        scrUmolL:
          scrUmolL
      });


    if (
      !core ||
      !Number.isFinite(
        Number(core.crcl)
      )
    ) {
      return null;
    }


    return {
      crcl:
        Number(
          core.crcl
        ),

      ibw:
        Number(
          core.ibw
        ),

      adjBW:
        core.adjBW !== null &&
        core.adjBW !== undefined
          ? Number(
              core.adjBW
            )
          : null,

      crclWeight:
        Number(
          core.crclWeight
        ),

      actualWeightKg:
        weight,

      isObese:
        core.adjBW !== null &&
        core.adjBW !== undefined,

      scrMgDl:
        scr,

      scrUmolL:
        scrUmolL
    };
  }


  /* =========================================================
   * 6. VANCOMYCIN — LOADING DOSE
   * ========================================================= */

  function getVancomycinLoadingDose(
    actualWeightKg
  ) {
    const weight =
      Number(
        actualWeightKg
      );

    if (
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      return NaN;
    }


    const raw =
      25 *
      weight;


    const capped =
      Math.min(
        raw,
        2000
      );


    /*
     * Làm tròn tới 250 mg.
     */
    return (
      Math.round(
        capped /
        250
      ) *
      250
    );
  }


  /* =========================================================
   * 7. VANCOMYCIN — MAINTENANCE
   * ========================================================= */

  function getVancomycinMaintenanceRegimen(
    crcl,
    actualWeightKg
  ) {
    const renal =
      Number(crcl);

    const weight =
      Number(
        actualWeightKg
      );


    if (
      !Number.isFinite(renal) ||
      renal < 0 ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      return {
        error:
          'Dữ liệu CrCl hoặc cân nặng không hợp lệ.'
      };
    }


    const rawDose =
      15 *
      weight;


    const roundedDose =
      Math.round(
        rawDose /
        250
      ) *
      250;


    if (
      renal >
      50
    ) {
      return {
        doseMg:
          roundedDose,

        intervalH:
          12,

        note:
          'CrCl > 50 mL/phút: 15 mg/kg mỗi 12 giờ'
      };
    }


    if (
      renal >=
      20
    ) {
      return {
        doseMg:
          roundedDose,

        intervalH:
          24,

        note:
          'CrCl 20–50 mL/phút: 15 mg/kg mỗi 24 giờ'
      };
    }


    return {
      doseMg:
        roundedDose,

      intervalH:
        null,

      note:
        'CrCl < 20 mL/phút: 15 mg/kg, định liều lại theo nồng độ đo được.',

      requiresConsult:
        true
    };
  }


  /* =========================================================
   * 8. VANCOMYCIN — HEMODIALYSIS
   * ========================================================= */

  function getVancomycinHemodialysisRegimen(
    actualWeightKg
  ) {
    const weight =
      Number(
        actualWeightKg
      );


    if (
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      return {
        error:
          'Cân nặng không hợp lệ.'
      };
    }


    let dose;


    if (
      weight <
      50
    ) {
      dose = 750;
    }

    else if (
      weight <
      70
    ) {
      dose = 1000;
    }

    else if (
      weight <=
      100
    ) {
      dose = 1500;
    }

    else {
      dose = 2000;
    }


    return {
      loadingDoseMg:
        dose,

      maintenanceDoseMg:
        dose,

      note:
        'Truyền vào cuối buổi lọc máu (post-dialysis)'
    };
  }


  /* =========================================================
   * 9. VANCOMYCIN — TROUGH TARGET
   * ========================================================= */

  function getVancomycinTroughTarget(
    riskCategory
  ) {
    if (
      riskCategory ===
      'high'
    ) {
      return {
        min:
          15,

        max:
          20,

        label:
          '15–20 mg/L (nguy cơ cao: nhiễm khuẩn nặng/MRSA xâm lấn)'
      };
    }


    return {
      min:
        10,

      max:
        15,

      label:
        '10–15 mg/L (chuẩn)'
    };
  }


  /* =========================================================
   * 10. API MODULE 2
   * ========================================================= */

  const RENAL_DOSING_API = {
    calcIBW:
      calcIBW,

    calcAdjustedDosingWeight:
      calcAdjustedDosingWeight,

    calcCrCl_CockcroftGault:
      calcCrCl_CockcroftGault,

    calcCrClCockcroftGault:
      calcCrClCockcroftGault,

    scrMgdlToUmol:
      scrMgdlToUmol,

    scrUmolToMgdl:
      scrUmolToMgdl,

    computeRenalCore:
      computeRenalCore,

    getVancomycinLoadingDose:
      getVancomycinLoadingDose,

    getVancomycinMaintenanceRegimen:
      getVancomycinMaintenanceRegimen,

    getVancomycinHemodialysisRegimen:
      getVancomycinHemodialysisRegimen,

    getVancomycinTroughTarget:
      getVancomycinTroughTarget
  };


  /* =========================================================
   * 11. EXPORT CHO TRÌNH DUYỆT
   * ========================================================= */

  if (
    typeof window !==
    'undefined'
  ) {
    window.calcIBW =
      calcIBW;

    window.calcAdjustedDosingWeight =
      calcAdjustedDosingWeight;

    window.calcCrCl_CockcroftGault =
      calcCrCl_CockcroftGault;

    window.calcCrClCockcroftGault =
      calcCrClCockcroftGault;

    window.scrMgdlToUmol =
      scrMgdlToUmol;

    window.scrUmolToMgdl =
      scrUmolToMgdl;

    /*
     * Hàm clinical-tools.js cần.
     */
    window.computeRenalCore =
      computeRenalCore;


    window.getVancomycinLoadingDose =
      getVancomycinLoadingDose;

    window.getVancomycinMaintenanceRegimen =
      getVancomycinMaintenanceRegimen;

    window.getVancomycinHemodialysisRegimen =
      getVancomycinHemodialysisRegimen;

    window.getVancomycinTroughTarget =
      getVancomycinTroughTarget;


    window.RENAL_DOSING_API =
      RENAL_DOSING_API;
  }


  /* =========================================================
   * 12. EXPORT CHO NODE / TEST
   * ========================================================= */

  if (
    typeof module !==
      'undefined' &&
    module.exports
  ) {
    module.exports =
      RENAL_DOSING_API;
  }

}(
  typeof window !== 'undefined'
    ? window
    : globalThis
));