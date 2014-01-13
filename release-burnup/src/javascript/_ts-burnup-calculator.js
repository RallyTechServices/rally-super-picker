Ext.define('Rally.technicalservices.calculator.BurnUp', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',

    getMetrics: function () {
        return [
            {
                field: 'PlanEstimate',     //sum plan estimate
                as: 'Planned',             //create a line series
                display: 'line',
                f: 'sum'
            },
            {
                field: 'PlanEstimate',    //sum completed plan estimate
                as: 'Accepted',          //create a column series
                f: 'filteredSum',
                filterField: 'ScheduleState',
                filterValues: ['Accepted', 'Released'],
                display: 'column'
            }
        ];
    }
});