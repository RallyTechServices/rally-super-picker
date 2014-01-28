Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    setting_key: 'rally.techservices.projectselection',
    project_names: [],
    logger: new Rally.technicalservices.Logger(),
    defaults: {
        padding: 5,
        margin: 5
    },
    items: [
        {xtype:'container',itemId:'message_box',tpl:'<tpl>{msg}</tpl>'},
        {xtype:'container',layout:{type:'hbox'},defaults: { margin: 5 }, items:[
            {xtype:'container',itemId:'release_box'},
            {xtype:'container',itemId:'tag_box'}
        ]},
        {xtype:'container',itemId:'chart_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        this.down('#message_box').update({msg:'Waiting for settings...'});
        this.subscribe(this, this.setting_key, this._onSettingUpdate, this);
        if ( ! window.top.Rally.alm ) {
            this._addSelectors([this.getContext().getProject()]);
        }
    },
    _onSettingUpdate: function(selected_projects) {
        var me = this;
        this.logger.log("updated",selected_projects);
        this.project_names = [];
        Ext.Array.each(selected_projects,function(project){
            me.project_names.push(project.get("Name"));
        });
        this._addReleaseBox(selected_projects);
        //this.down('#message_box').update({msg: me.project_names.join(', ')});
    },
    _addSelectors: function(selected_projects){
        var release_picker = this._addReleaseBox(selected_projects);

        this.tag_oids = [];
        var tag_picker = this._addTagBox();
        // adding change after the fact because we don't want it to fire
        // before the release_box exists
        tag_picker.on('blur',function(tb) {
                var me = this;
                this.logger.log("blur tags",tb.getValue());
                this.tag_oids = [];
                if ( this.chart ) { this.chart.destroy(); }
                Ext.Array.each(tb.getValue(), function(tag){
                    me.tag_oids.push(tag.get('ObjectID'));
                });
                this._getScopedReleases(release_picker.getRecord(),selected_projects);
            },
            this
        );
        
    },
    _addTagBox: function() {
        this.down('#tag_box').removeAll();
        return this.down('#tag_box').add({
            xtype: 'rallytagpicker',
            autoExpand: false,
            labelWidth: 35,
            fieldLabel: 'Tag(s)',
            stateId:'ts_super_releaseburndown_tags',
            stateEvents:'change',
            stateful: true
        });
    },
    _addReleaseBox: function(selected_projects) {
        this.down('#release_box').removeAll();
        this.down('#message_box').update();
        
        return this.down('#release_box').add({
            xtype:'rallyreleasecombobox',
            fieldLabel:'Release:',
            labelWidth: 45,
            stateId:'ts_super_releaseburndown_release',
            stateEvents:'change',
            stateful: true,
            listeners: {
                scope: this,
                change: function(rb,new_value,old_value) {
                    this.logger.log("change",rb.getRecord());
                    if ( this.chart ) { this.chart.destroy(); }
                    this._getScopedReleases(rb.getRecord(),selected_projects);
                }
            }
        });
    },
    _getScopedReleases: function(release,selected_projects) {        
        var filter = Ext.create('Rally.data.wsapi.Filter',{property:"Name",value:release.get('Name')});
        
        var project_filter = null;
        if ( selected_projects.length > 0 ) {
            var project_oid = selected_projects[0].ObjectID;
            if ( !project_oid  ) {
                project_oid = selected_projects[0].get('ObjectID')
            }
            project_filter = Ext.create('Rally.data.wsapi.Filter',{
                property:"Project.ObjectID",
                value:project_oid
            });
        
            for ( var i=1;i<selected_projects.length;i++ ) {
                project_filter = project_filter.or(
                    Ext.create('Rally.data.wsapi.Filter',{property:"Project.ObjectID",value:selected_projects[i].get('ObjectID')})
                );
            }
        }
        
        if ( project_filter ) { 
            filter = filter.and(project_filter);
        }
        
        Ext.create('Rally.data.wsapi.Store',{
            model:'Release',
            autoLoad: true,
            filters:filter,
            context: {
                projectScopeUp: false,
                projectScopeDown: false,
                project: null
            },
            listeners: {
                scope: this,
                load: function(store,records) {
                    var record_oids = [];
                    Ext.Array.each(records,function(record){
                        record_oids.push(record.get('ObjectID'));
                    });
                    this._getReleaseData(release,record_oids,selected_projects);
                }
            }
        });
    },
    _getReleaseData:function(release,release_oids,selected_projects) {
        this.logger.log(release_oids,selected_projects);
        var start_date = release.get("ReleaseStartDate");
        var end_date = release.get("ReleaseDate");
        this.logger.log(release.get("Name"),start_date,end_date);
        
        if ( this.chart ) { this.chart.destroy(); }

        var project_names = this.project_names.join(',');
        var filters = [
            { property:'_TypeHierarchy',operator:'in',value:['HierarchicalRequirement'] },
            { property:'Release',operator:'in',value:release_oids }
        ];
        if ( this.tag_oids.length > 0 ) {
            filters.push({property:'Tags',operator:'in',value:this.tag_oids});
        }
        this.chart = Ext.create('Rally.ui.chart.Chart', {
            storeType: 'Rally.data.lookback.SnapshotStore',
            calculatorType: 'Rally.technicalservices.calculator.BurnUp',
            calculatorConfig: {
                endDate: end_date,
                startDate: start_date
            },
            storeConfig: {
               filters: filters,
               fetch: ['ScheduleState', 'PlanEstimate'],
               hydrate: ['ScheduleState'],
               sort: {
                   '_ValidFrom': 1
               }
            },
            chartConfig: {
                title: {
                    text: project_names
                },
                chart: {
                    zoomType: "xy"
                },
                xAxis: {
                    title: {
                        text: "Date"
                    },
                    labels: {
                        align: 'left',
                        rotation: 75
                    }
                },
                yAxis: [
                    {
                        title: {
                            text: "Points"
                        }
                    }
                ],
                plotOptions: {
                    line: {
                        color: "#000"
                    },
                    column: {
                        stacking: null,
                        color: "#6AB17D",
                        lineColor: "#666666",
                        lineWidth: 1,
                        marker: {
                            lineWidth: 1,
                            lineColor: "#666666"
                        },
                        shadow: false
                    }
                }
            }
        });
        
        this.down('#chart_box').add(this.chart);

    }
});
