Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    type_key: 'rally.techservices.projecttype',
    setting_key: 'rally.techservices.projectselection',
    type_field_name: '_credittype',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'outer_box', autoScroll: true, height: 400, defaults: { margin: 5, padding: 5 }, layout: 'hbox', items: [
            {xtype:'container',itemId:'source_box',  width: 150},
            {xtype:'container',itemId:'target_box',  width: 150}
        ]},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var me = this;
        Deft.Chain.pipeline([this._getProjects,this._getProjectTypes,this._getExistingSettings,this._displayProjects],this);
    },
    _getProjects: function() {
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store',{
            model:'Project',
            autoLoad: true,
            fetch:['ObjectID','Children','Name'],
            listeners: {
                load: function(store,projects) {
                    var leaf_projects = [];
                    Ext.Array.each(projects,function(project){
                        if ( project.get('Children').Count == 0 ) {
                            leaf_projects.push(project);
                        }
                    });
                    deferred.resolve(leaf_projects);
                }
            }
        });
        return deferred.promise;
    },
    _getProjectTypes: function(projects){
        var me = this;
        this.logger.log("_getProjectTypes",projects);
        var deferred = Ext.create('Deft.Deferred');
        var project_hash = {}; // key will be oid
        var filtered_projects = [];
        Ext.Array.each(projects,function(project){
            project.set(me.type_field_name,"None");
            project_hash[project.get('ObjectID')] = project;
        });
        
        // this is for development ease
        if ( this.getAppId() ) {
            this.logger.log("inside Rally");
            Ext.create('Rally.data.wsapi.Store',{
                model: 'Preference',
                autoLoad: true,
                filters: [{property:"Name",value:this.type_key}],
                listeners:{
                    scope: this,
                    load: function(store,prefs) {
                        Ext.Array.each( prefs, function(pref){
                            var pref_project_oid = pref.get('Project').ObjectID;
                            if ( project_hash[pref_project_oid] ) {
                                var project = project_hash[pref_project_oid];
                                project.set(me.type_field_name,pref.get('Value'));
                                if ( pref.get('Value') !== "None" ) {
                                    filtered_projects.push(project);
                                }
                            }
                        });
                        deferred.resolve(filtered_projects);
                    }
                }
            });
        } else {
            this.logger.log("Outside Rally");
            var counter = 1;
            Ext.Array.each(projects,function(project){
                if ( counter % 2 === 0 ) {
                    project.set(me.type_field_name,"Type A");
                } else {
                    project.set(me.type_field_name,"Type B");
                }
                counter++;
            });
            deferred.resolve(projects);
        }
        
        return deferred.promise;
    },
    _getExistingSettings: function(projects) {
        var me = this;
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.PreferenceManager.load({
            appID: this.getAppId(),
            filterByUser: false,
            success: function(prefs) {
                var selected_oids = [];
                if ( prefs[me.setting_key] ) {
                    selected_oids = Ext.JSON.decode(prefs[me.setting_key]);
                }
                Ext.Array.each(projects,function(project){
                    if ( Ext.Array.indexOf(selected_oids,project.get('ObjectID')) > -1 ) {
                        me._setSelected(project, true);
                    } else { 
                        me._setSelected(project, false);
                    }
                });
                me._sendMessage(projects);
                deferred.resolve(projects);
            }
        });
        return deferred.promise;
    },
    _sendMessage: function(projects) {
        var selected_project_oids = [];
        Ext.Array.each(projects, function(project){
            if ( project.get("_selected") ) {
                selected_project_oids.push(project);
            }
        });
        this.publish(this.setting_key, selected_project_oids);
    },
    _displayProjects: function(projects){
        var me = this;
        this.project_set = [];
        var source_data = [];
        var target_data = [];
        
        Ext.Array.each(projects, function(project) {
            me.project_set.push(project);
            if ( project.get('_selected') ) {
                target_data.push(project);
            } else {
                source_data.push(project);
            }
        });
        
        this.source_store = Ext.create('Rally.data.custom.Store',{
            groupField: me.type_field_name,
            data:source_data
        });
        
        var target_store = Ext.create('Rally.data.custom.Store',{
            data:target_data
        });   
        
        this.down('#target_box').add({
            xtype:'rallygrid',
            store: target_store,
            showRowActionsColumn: false,
            showPagingToolbar: false,
            columnCfgs: [
                { text: 'Selected Projects', dataIndex: 'Name' }
            ],
            viewConfig: {
                plugins: {
                    ptype: 'gridviewdragdrop',
                    dragGroup: 'firstGridDDGroup',
                    dropGroup: 'secondGridDDGroup'
                },
                listeners: {
                    drop: function(node, data, dropRec, dropPosition) {
                        me._setSelected(data.records[0], true);
                    }
                }
            }
        }); 
        
        this.grid = this.down('#source_box').add({
            xtype:'rallygrid',
            store: this.source_store,
            features: [{
                ftype:'grouping',
                groupHeaderTpl: '{name}'
            }],
            showRowActionsColumn: false,
            showPagingToolbar: false,
            columnCfgs: [
                { text: 'Available Projects', dataIndex: 'Name' }
            ],
            viewConfig: {
                plugins: {
                    ptype: 'gridviewdragdrop',
                    dragGroup: 'secondGridDDGroup',
                    dropGroup: 'firstGridDDGroup'
                },
                listeners: {
                    drop: function(node, data, dropRec, dropPosition) {
//                        var dropOn = dropRec ? ' ' + dropPosition + ' ' + dropRec.get('Name') : ' on empty view';
//                        me.logger.log('dropRec',dropRec);
//                        me.logger.log('dropPosition',dropPosition);
//                        me.logger.log('node',node);
//                        me.logger.log( 'Dropped ' + data.records[0].get(me.type_field_name) + dropOn);
                        me._setSelected(data.records[0], false);
                    }
                }
            }
        }); 
    },
    _setSelected: function(record,selected) {
        var me = this;
        record.set("_selected",selected);
        
        if ( this.source_store ) {
            this.logger.log("setting selected",record,record.get('ObjectID'),selected);
//            this.source_store.clearFilter(true);
//            var item = this.source_store.findRecord("ObjectID",record.get('ObjectID'));
//            this.source_store.filter({property:'_selected',value:false});
//            if ( item ) {
//                item.set("_selected",selected);
//            }
        }
        
        var selected_array = [];
        Ext.Array.each(this.project_set, function(project){
            if ( project.get('_selected') ) {
                selected_array.push(project.get('ObjectID'));
            }
        });
        me._sendMessage(this.project_set);
        me.logger.log('--', selected_array);
        
        var settings = {};
        settings[this.setting_key] = Ext.JSON.encode(selected_array);
        Rally.data.PreferenceManager.update({
            appID: this.getAppId(),
            filterByUser: false,
            settings: settings,
            success: function(updatedRecords, notUpdatedRecords) {
                //yay!
            }
        });
    }
});
