Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    key: 'rally.techservices.projecttype',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container', padding: 5, margin: 5, itemId:'tree_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var me = this;
        Deft.Chain.pipeline([this._getProjects,this._getProjectTypes,this._displayProjects],this);
    },
    _getProjects: function() {
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store',{
            model:'Project',
            limit:'Infinity',
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
        var deferred = Ext.create('Deft.Deferred');
        var project_hash = {}; // key will be oid
        Ext.Array.each(projects,function(project){
            project.set("_credittype","None");
            project_hash[project.get('ObjectID')] = project;
        });
        
        Ext.create('Rally.data.wsapi.Store',{
            model: 'Preference',
            autoLoad: true,
            filters: [{property:"Name",value:this.key}],
            limit:'Infinity',
            listeners:{
                scope: this,
                load: function(store,prefs) {
                    this.logger.log("existing preferences",prefs);
                    Ext.Array.each( prefs, function(pref){
                        var pref_project_oid = pref.get('Project').ObjectID;
                        if ( project_hash[pref_project_oid] ) {
                            project_hash[pref_project_oid].set('_credittype',pref.get('Value'));
                        }
                    });
                    deferred.resolve(projects);
                }
            }
        });
        
        return deferred.promise;
    },
    _displayProjects: function(projects){
        var me = this;
        var data = [];
        Ext.Array.each(projects, function(project) {
            data.push(project); 
        });
        
        this.logger.log("Number of Projects for table ",data.length);
        
        var store = Ext.create('Rally.data.custom.Store',{
            data:data,
            limit:'Infinity',
            pageSize:3000
        });
                    
        var typebox = this._getTypeBox();
        
        this.down('#tree_box').add({
            xtype:'rallygrid',
            store: store,
            showRowActionsColumn: false,
            showPagingToolbar: false,
            columnCfgs: [
                { text: 'Project', dataIndex: 'Name' },
                { text: 'Type', dataIndex: '_credittype', editor: typebox  }
            ],
            listeners: {
                scope: this,
                edit: function(editor,e) {
                    this._setTypePreference(e.record,e.value);
                }
            }
        });
    },
    _getTypeBox: function() {
        return Ext.create('Rally.ui.combobox.ComboBox',{
            store: ['None','No Credit','Credit']
        });
    },
    _setTypePreference: function(project,type) {
        var settings = {};
        settings[this.key] = type;
        Rally.data.PreferenceManager.update({
            project: project,
            filterByUser: false,
            settings: settings,
            success: function(updatedRecords, notUpdatedRecords) {
                //yay!
            }
        });
    }
});
